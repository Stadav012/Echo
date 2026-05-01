import asyncio
import logging
import signal
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

from config import API_KEY, BASE_URL
from models import CreateSessionRequest, CreateSessionResponse, SessionStatusResponse
from pipeline import run_pipeline
from session_manager import SessionManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

session_manager = SessionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await session_manager.startup()

    loop = asyncio.get_event_loop()

    def _shutdown_signal(*_):
        asyncio.create_task(session_manager.shutdown())

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _shutdown_signal)

    yield

    await session_manager.shutdown()


app = FastAPI(title="Voice Agent", lifespan=lifespan)


def _require_api_key(x_api_key: str = Header(default="")) -> None:
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/sessions/create", response_model=CreateSessionResponse)
async def create_session(
    body: CreateSessionRequest,
    x_api_key: str = Header(default=""),
) -> CreateSessionResponse:
    _require_api_key(x_api_key)
    session = await session_manager.create_session(body)
    return CreateSessionResponse(
        session_id=session.session_id,
        talk_url=f"{BASE_URL}/talk/{session.session_id}",
        expires_at=session.expires_at.isoformat().replace("+00:00", "Z"),
    )


@app.get("/talk/{session_id}", response_class=HTMLResponse)
async def talk_page(session_id: str) -> HTMLResponse:
    session = await session_manager.get_session(session_id)

    if session is None:
        raw = await session_manager._load(session_id)
        if raw is not None and raw.status == "expired":
            return HTMLResponse(content=_error_page("410", "Session Expired", "This session has expired."), status_code=410)
        return HTMLResponse(content=_error_page("404", "Not Found", "Session not found."), status_code=404)

    if session.status == "expired":
        return HTMLResponse(content=_error_page("410", "Session Expired", "This session has expired."), status_code=410)

    with open("static/talk.html", "r") as f:
        html = f.read()

    html = html.replace("{{SESSION_ID}}", session_id)
    return HTMLResponse(content=html)


@app.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str) -> None:
    session = await session_manager.get_session(session_id)
    if session is None or session.status in ("expired", "completed"):
        await websocket.close(code=4004)
        return

    await websocket.accept()
    await session_manager.update_status(session_id, "active")
    session_manager.register_browser_ws(session_id, websocket)
    logger.info("WebSocket accepted for session %s", session_id)

    asyncio.create_task(session_manager.kickoff_agent(session_id))

    try:
        await run_pipeline(session, websocket, session_manager)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as exc:
        logger.exception("Unhandled WS error for session %s: %s", session_id, exc)
    finally:
        session_manager.unregister_browser_ws(session_id)
        current = await session_manager.get_session(session_id)
        if current and current.status not in ("completed", "expired"):
            await session_manager.update_status(session_id, "completed")
            await session_manager.send_callback(session_id)
        session_manager.remove_pipeline(session_id)


@app.post("/sessions/{session_id}/end")
async def end_session_route(
    session_id: str,
    x_api_key: str = Header(default=""),
) -> dict:
    """Force-end a live voice session (researcher dashboard)."""
    _require_api_key(x_api_key)
    session = await session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status in ("completed", "expired"):
        return {"ok": True, "status": session.status}
    await session_manager.end_session(session_id, "researcher", force_cancel=True)
    return {"ok": True, "status": "completed"}


@app.post("/sessions/{session_id}/participant_end")
async def participant_end_route(session_id: str) -> dict:
    """Participant hang-up from talk.html. No API key — same trust as /talk/{id}."""
    session = await session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status in ("completed", "expired"):
        return {"ok": True, "status": session.status}
    await session_manager.end_session(session_id, "participant", force_cancel=True)
    return {"ok": True, "status": "completed"}


@app.websocket("/agent/{session_id}")
async def agent_ws_endpoint(websocket: WebSocket, session_id: str) -> None:
    """
    WebSocket for the external backend (the one that has the LLM).

    Flow:
      1. Backend connects here with X-API-Key as a query param or first message.
      2. Server sends: { "type": "transcription", "text": "..." } for each
         customer utterance.
      3. Backend replies: { "type": "response", "text": "..." } with the
         LLM-generated reply, which gets spoken via Cartesia TTS.
    """
    x_api_key = websocket.query_params.get("api_key", "")
    if x_api_key != API_KEY:
        await websocket.close(code=4001)
        return

    session = await session_manager.get_session(session_id)
    if session is None or session.status in ("expired", "completed"):
        await websocket.close(code=4004)
        return

    await websocket.accept()
    await session_manager.connect_agent(session_id, websocket)
    logger.info("Agent WS connected for session %s", session_id)

    try:
        async for msg in websocket.iter_json():
            if msg.get("type") == "response" and msg.get("text"):
                session_manager.put_agent_response(
                    session_id,
                    msg["text"],
                    end_after=bool(msg.get("end_after")),
                )
    except WebSocketDisconnect:
        logger.info("Agent WS disconnected for session %s", session_id)
    except Exception as exc:
        logger.exception("Agent WS error for session %s: %s", session_id, exc)
    finally:
        session_manager.disconnect_agent(session_id)


@app.get("/sessions/{session_id}", response_model=SessionStatusResponse)
async def get_session_status(
    session_id: str,
    x_api_key: str = Header(default=""),
) -> SessionStatusResponse:
    _require_api_key(x_api_key)
    session = await session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionStatusResponse(
        session_id=session.session_id,
        status=session.status,
        transcript=session.transcript,
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "active_sessions": session_manager.active_session_count()}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _error_page(code: str, title: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{code} — {title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f8fafc; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; color: #1e293b; }}
    .card {{ background: white; border-radius: 12px; padding: 48px 40px;
             box-shadow: 0 4px 24px rgba(0,0,0,.08); text-align: center; max-width: 400px; }}
    h1 {{ font-size: 56px; font-weight: 700; color: #e2e8f0; margin: 0 0 8px; }}
    h2 {{ font-size: 20px; font-weight: 600; margin: 0 0 12px; }}
    p  {{ color: #64748b; margin: 0; line-height: 1.6; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>{code}</h1>
    <h2>{title}</h2>
    <p>{message}</p>
  </div>
</body>
</html>"""
