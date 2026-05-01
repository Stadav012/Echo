import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from agent import KICKOFF_MARKER, run_research_agent
from config import (
    BASE_URL,
    CALLBACK_SECRET,
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
    REDIS_URL,
    SESSION_TIMEOUT_SECONDS,
)
from models import CreateSessionRequest, SessionState, TranscriptEntry

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._pipelines: dict[str, Any] = {}
        self._redis: Any = None
        self._sweep_task: asyncio.Task | None = None
        # Agent WebSocket relay (external backend ↔ pipeline)
        self._agent_ws: dict[str, Any] = {}
        self._agent_queues: dict[str, asyncio.Queue] = {}
        # In-process ResearchAgent task per session
        self._agent_tasks: dict[str, asyncio.Task] = {}
        # Browser-facing WebSocket per session (for pushing transcript JSON)
        self._browser_ws: dict[str, Any] = {}
        # Per-session event signalled by BotSpeakingWatchdog when TTS finishes
        self._bot_speaking_done: dict[str, asyncio.Event] = {}

    async def startup(self) -> None:
        if REDIS_URL:
            try:
                import redis.asyncio as aioredis

                self._redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
                await self._redis.ping()
                logger.info("Connected to Redis at %s", REDIS_URL)
            except Exception as exc:
                logger.warning("Redis unavailable (%s); falling back to in-memory store", exc)
                self._redis = None

        self._sweep_task = asyncio.create_task(self._sweep_loop())

    async def shutdown(self) -> None:
        if self._sweep_task:
            self._sweep_task.cancel()

        active = [
            sid
            for sid, s in self._sessions.items()
            if s.status in ("pending", "active")
        ]
        await asyncio.gather(
            *[self._complete_and_callback(sid) for sid in active],
            return_exceptions=True,
        )

        for sid in list(self._agent_tasks.keys()):
            self._cancel_agent_task(sid)

        if self._redis:
            await self._redis.aclose()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def create_session(self, request: CreateSessionRequest) -> SessionState:
        now = _now()
        from datetime import timedelta

        expires = now + timedelta(seconds=SESSION_TIMEOUT_SECONDS)

        session = SessionState(
            session_id=str(uuid.uuid4()),
            customer_id=request.customer_id,
            customer_name=request.customer_name,
            context=request.context,
            callback_url=request.callback_url,
            metadata=request.metadata,
            status="pending",
            transcript=[],
            created_at=now,
            expires_at=expires,
        )

        await self._save(session)
        logger.info("Session created: %s for customer %s", session.session_id, session.customer_id)
        self._spawn_agent(session)
        return session

    def _spawn_agent(self, session: SessionState) -> None:
        """Start the in-process ResearchAgent task for this session."""
        if not LLM_BASE_URL:
            logger.warning(
                "LLM_BASE_URL not set; skipping ResearchAgent spawn for %s",
                session.session_id,
            )
            return

        async def _runner() -> None:
            try:
                await run_research_agent(session, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception(
                    "ResearchAgent crashed for session %s: %s", session.session_id, exc
                )

        task = asyncio.create_task(_runner())
        self._agent_tasks[session.session_id] = task
        logger.info(
            "ResearchAgent task spawned for session %s (model=%s)",
            session.session_id,
            LLM_MODEL,
        )

    def _cancel_agent_task(self, session_id: str) -> None:
        task = self._agent_tasks.pop(session_id, None)
        if task and not task.done():
            task.cancel()

    async def get_session(self, session_id: str) -> SessionState | None:
        session = await self._load(session_id)
        if session is None:
            return None
        if session.status not in ("expired", "completed") and _now() > session.expires_at:
            await self.expire_session(session_id)
            return None
        return session

    async def update_status(self, session_id: str, status: str) -> None:
        session = await self._load(session_id)
        if session is None:
            return
        session.status = status  # type: ignore[assignment]
        await self._save(session)

    async def append_transcript(self, session_id: str, role: str, text: str) -> None:
        session = await self._load(session_id)
        if session is None:
            return
        entry = TranscriptEntry(role=role, text=text, timestamp=_iso(_now()))
        session.transcript.append(entry)
        await self._save(session)

    async def expire_session(self, session_id: str) -> None:
        await self.update_status(session_id, "expired")
        self._pipelines.pop(session_id, None)
        self._bot_speaking_done.pop(session_id, None)
        self._cancel_agent_task(session_id)
        logger.info("Session expired: %s", session_id)

    async def send_callback(self, session_id: str) -> None:
        session = await self._load(session_id)
        if session is None:
            return

        payload = {
            "session_id": session.session_id,
            "customer_id": session.customer_id,
            "status": session.status,
            "transcript": [e.model_dump() for e in session.transcript],
            "metadata": session.metadata,
            "created_at": _iso(session.created_at),
            "completed_at": _iso(_now()),
        }
        body = json.dumps(payload, ensure_ascii=False).encode()
        sig = hmac.new(CALLBACK_SECRET.encode(), body, hashlib.sha256).hexdigest()

        delays = [1, 2, 4]
        async with httpx.AsyncClient(timeout=10) as client:
            for attempt, delay in enumerate(delays, 1):
                try:
                    resp = await client.post(
                        session.callback_url,
                        content=body,
                        headers={
                            "Content-Type": "application/json",
                            "X-Signature": f"sha256={sig}",
                        },
                    )
                    resp.raise_for_status()
                    logger.info(
                        "Callback sent for session %s (attempt %d, status %d)",
                        session_id,
                        attempt,
                        resp.status_code,
                    )
                    return
                except Exception as exc:
                    logger.warning(
                        "Callback attempt %d failed for session %s: %s",
                        attempt,
                        session_id,
                        exc,
                    )
                    if attempt < len(delays):
                        await asyncio.sleep(delay)

        logger.error("All callback attempts failed for session %s", session_id)

    # ------------------------------------------------------------------
    # Agent WebSocket relay
    # ------------------------------------------------------------------

    async def connect_agent(self, session_id: str, websocket: Any) -> asyncio.Queue:
        """Register the external backend's WebSocket. Returns a queue the
        pipeline reads from to get LLM responses."""
        q: asyncio.Queue = asyncio.Queue()
        self._agent_ws[session_id] = websocket
        self._agent_queues[session_id] = q
        logger.info("Agent backend connected for session %s", session_id)
        return q

    def disconnect_agent(self, session_id: str) -> None:
        self._agent_ws.pop(session_id, None)
        self._agent_queues.pop(session_id, None)
        logger.info("Agent backend disconnected for session %s", session_id)

    def has_agent(self, session_id: str) -> bool:
        return session_id in self._agent_ws

    async def send_transcription_to_agent(self, session_id: str, text: str) -> bool:
        """Push a customer transcription to the external backend. Returns False
        if no backend is connected."""
        ws = self._agent_ws.get(session_id)
        if ws is None:
            return False
        try:
            await ws.send_json({"type": "transcription", "text": text})
            return True
        except Exception as exc:
            logger.warning("Failed to send transcription to agent for %s: %s", session_id, exc)
            return False

    async def kickoff_agent(self, session_id: str, timeout: float = 5.0) -> None:
        """Inject a synthetic kickoff transcription into the pipeline so the
        agent speaks first (greeting + Q1) before the participant says
        anything. Waits briefly for the pipeline task to be registered."""
        from pipecat.frames.frames import TranscriptionFrame

        deadline = asyncio.get_event_loop().time() + timeout
        task = self._pipelines.get(session_id)
        while task is None and asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(0.1)
            task = self._pipelines.get(session_id)

        if task is None:
            logger.warning("kickoff_agent: no pipeline registered for %s", session_id)
            return

        frame = TranscriptionFrame(
            text=KICKOFF_MARKER,
            user_id="system",
            timestamp=_iso(_now()),
        )
        try:
            await task.queue_frames([frame])
            logger.info("Kickoff transcription queued for session %s", session_id)
        except Exception as exc:
            logger.warning("kickoff_agent failed for %s: %s", session_id, exc)

    async def get_agent_response(
        self, session_id: str, timeout: float = 10.0
    ) -> tuple[str | None, bool]:
        """Wait for the in-process agent to push a reply. Returns (text, end_after)."""
        q = self._agent_queues.get(session_id)
        if q is None:
            return None, False
        try:
            item = await asyncio.wait_for(q.get(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("Agent response timeout for session %s", session_id)
            return None, False

        if isinstance(item, dict):
            return (item.get("text"), bool(item.get("end_after")))
        if isinstance(item, str):
            return item, False
        return None, False

    def put_agent_response(self, session_id: str, text: str, end_after: bool = False) -> None:
        """Called by the /agent WebSocket handler when a response arrives."""
        q = self._agent_queues.get(session_id)
        if q:
            q.put_nowait({"text": text, "end_after": end_after})

    async def end_session(self, session_id: str, reason: str, *, force_cancel: bool = False) -> None:
        """Mark completed, send callback, stop pipeline, notify browser, tear down agent."""
        session = await self._load(session_id)
        if session is None:
            return
        if session.status in ("completed", "expired"):
            logger.info("end_session noop (already terminal) %s", session_id)
            return

        await self.update_status(session_id, "completed")
        await self.send_callback(session_id)

        pipe = self._pipelines.get(session_id)
        if pipe:
            try:
                if force_cancel:
                    await pipe.cancel(reason=reason)
                else:
                    await pipe.stop_when_done()
            except Exception as exc:
                logger.warning("end_session pipeline stop for %s: %s", session_id, exc)

        await self.send_browser_message(session_id, {"type": "session_end"})

        ws = self._browser_ws.get(session_id)
        if ws and force_cancel:
            try:
                await ws.close(code=1000)
            except Exception:
                pass

        self._cancel_agent_task(session_id)
        self.disconnect_agent(session_id)
        self._bot_speaking_done.pop(session_id, None)

    # ------------------------------------------------------------------
    # Browser-facing WebSocket (participant page)
    # ------------------------------------------------------------------

    def register_browser_ws(self, session_id: str, websocket: Any) -> None:
        self._browser_ws[session_id] = websocket

    def unregister_browser_ws(self, session_id: str) -> None:
        self._browser_ws.pop(session_id, None)

    async def send_browser_message(self, session_id: str, payload: dict[str, Any]) -> bool:
        """Push a JSON message to the participant page. Returns False if the
        socket isn't registered or send failed."""
        ws = self._browser_ws.get(session_id)
        if ws is None:
            return False
        try:
            await ws.send_json(payload)
            return True
        except Exception as exc:
            logger.warning("Failed to push browser message for %s: %s", session_id, exc)
            return False

    # ------------------------------------------------------------------
    # Bot-speaking lifecycle (driven by BotSpeakingWatchdog in pipeline.py)
    # ------------------------------------------------------------------

    def arm_bot_speaking_done(self, session_id: str) -> asyncio.Event:
        """Create (or reset) the event awaited by BackendRelayProcessor while
        TTS is playing. Called immediately before pushing a TextFrame to TTS."""
        ev = asyncio.Event()
        self._bot_speaking_done[session_id] = ev
        return ev

    def signal_bot_speaking_done(self, session_id: str) -> None:
        """Called by BotSpeakingWatchdog when Pipecat publishes
        BotStoppedSpeakingFrame — i.e. TTS audio has fully drained."""
        ev = self._bot_speaking_done.get(session_id)
        if ev and not ev.is_set():
            ev.set()

    # ------------------------------------------------------------------
    # Pipeline tracking
    # ------------------------------------------------------------------

    def register_pipeline(self, session_id: str, pipeline: Any) -> None:
        self._pipelines[session_id] = pipeline

    def get_pipeline(self, session_id: str) -> Any | None:
        return self._pipelines.get(session_id)

    def remove_pipeline(self, session_id: str) -> None:
        self._pipelines.pop(session_id, None)

    def active_session_count(self) -> int:
        return sum(
            1
            for s in self._sessions.values()
            if s.status in ("pending", "active")
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _complete_and_callback(self, session_id: str) -> None:
        await self.update_status(session_id, "completed")
        await self.send_callback(session_id)
        self.remove_pipeline(session_id)
        self._bot_speaking_done.pop(session_id, None)
        self._cancel_agent_task(session_id)

    async def _save(self, session: SessionState) -> None:
        if self._redis:
            await self._redis.set(
                f"session:{session.session_id}",
                session.model_dump_json(),
                ex=SESSION_TIMEOUT_SECONDS * 2,
            )
        self._sessions[session.session_id] = session

    async def _load(self, session_id: str) -> SessionState | None:
        if self._redis:
            raw = await self._redis.get(f"session:{session_id}")
            if raw is None:
                return None
            session = SessionState.model_validate_json(raw)
            self._sessions[session_id] = session
            return session
        return self._sessions.get(session_id)

    async def _sweep_loop(self) -> None:
        while True:
            await asyncio.sleep(60)
            try:
                now = _now()
                stale = [
                    sid
                    for sid, s in list(self._sessions.items())
                    if s.status in ("pending", "active") and now > s.expires_at
                ]
                for sid in stale:
                    logger.info("Sweep: expiring session %s", sid)
                    await self.expire_session(sid)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Sweep loop error: %s", exc)
