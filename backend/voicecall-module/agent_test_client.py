"""
agent_test_client.py — LEGACY manual smoke-test for the /agent/{id} WebSocket.

The runtime now spawns a ResearchOrchestrator (see agent.py) inside the FastAPI
service for every new session, which means /agent/{id} is normally already
occupied. Running this script against a session created via the normal flow
will race the in-process agent and produce duplicate replies.

Keep it around only for verifying the WS protocol in isolation. To use it,
disable the in-process agent (e.g. by unsetting LLM_BASE_URL) before
creating the session.

Usage:
    # Let the script create a session for you:
    python agent_test_client.py

    # Or pass an existing session_id:
    python agent_test_client.py <session_id>

What it does:
    1. Creates a session via POST /sessions/create (unless session_id provided).
    2. Prints the talk_url so you can open it in a browser.
    3. Connects to /agent/{session_id} and waits.
    4. Each time the customer speaks, logs the transcription here.
    5. Sends the next line from dummy_responses.txt back as the agent response.
"""

import asyncio
import itertools
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import websockets
from dotenv import load_dotenv

load_dotenv()

import os

BASE_URL  = os.getenv("BASE_URL", "http://localhost:8000")
API_KEY   = os.getenv("API_KEY", "")
DUMMY_TXT = Path(__file__).parent / "dummy_responses.txt"
LOG_FILE  = Path(__file__).parent / "transcripts" / "agent_client.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("agent_client")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_dummy_lines() -> list[str]:
    lines = [l.strip() for l in DUMMY_TXT.read_text().splitlines() if l.strip()]
    if not lines:
        raise RuntimeError(f"{DUMMY_TXT} is empty")
    return lines


def _write_log(role: str, text: str) -> None:
    LOG_FILE.parent.mkdir(exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{ts}] {role.upper()}: {text}\n")


async def create_session() -> tuple[str, str]:
    """POST /sessions/create and return (session_id, talk_url)."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/sessions/create",
            headers={"Content-Type": "application/json", "X-API-Key": API_KEY},
            json={
                "customer_id": "test_001",
                "customer_name": "Tendai",
                "context": "Test session via agent_test_client",
                "callback_url": f"{BASE_URL}/health",
                "metadata": {},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["session_id"], data["talk_url"]


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

async def run_agent(session_id: str) -> None:
    dummy_lines = _load_dummy_lines()
    responses   = itertools.cycle(dummy_lines)

    ws_url = BASE_URL.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_url}/agent/{session_id}?api_key={API_KEY}"

    log.info("Connecting to agent WS: %s", ws_url)

    async with websockets.connect(ws_url) as ws:
        log.info("Connected. Waiting for customer to speak…\n")

        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                log.warning("Non-JSON message received: %s", raw)
                continue

            if msg.get("type") == "transcription":
                text = msg.get("text", "").strip()
                if not text:
                    continue

                # ── Log the customer's words ──────────────────────────────
                log.info("CUSTOMER ▶  %s", text)
                _write_log("customer", text)

                # ── Pick the next dummy response ──────────────────────────
                reply = next(responses)
                log.info("AGENT    ◀  %s\n", reply)
                _write_log("agent", reply)

                # ── Send it back to the pipeline (→ Cartesia TTS) ─────────
                await ws.send(json.dumps({"type": "response", "text": reply}))

            else:
                log.debug("Unhandled message type: %s", msg.get("type"))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    if len(sys.argv) > 1:
        session_id = sys.argv[1]
        talk_url   = f"{BASE_URL}/talk/{session_id}"
        log.info("Using existing session: %s", session_id)
    else:
        log.info("Creating new session…")
        session_id, talk_url = await create_session()
        log.info("Session created: %s", session_id)

    print(f"\n  Open this URL in your browser to start the conversation:\n")
    print(f"    {talk_url}\n")

    await run_agent(session_id)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Agent client stopped.")
