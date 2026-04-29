import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from config import (
    BASE_URL,
    CALLBACK_SECRET,
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
        return session

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
