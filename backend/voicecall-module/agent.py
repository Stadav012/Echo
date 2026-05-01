"""In-process research interview orchestrator: deterministic question tracker + one LLM call per turn."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import websockets

from agent_composer import compose_kickoff, compose_utterance
from agent_state import QuestionTracker, questions_from_metadata
from config import API_KEY, BASE_URL
from models import SessionState

logger = logging.getLogger(__name__)

KICKOFF_MARKER = "[CALL_STARTED]"


def _participant_first_name(session: SessionState) -> str:
    md = session.metadata or {}
    contact = md.get("contact") or {}
    name = (contact.get("name") or session.customer_name or "there").strip()
    return name.split()[0] if name else "there"


def _farewell_text(session: SessionState) -> str:
    name = _participant_first_name(session)
    return (
        f"That's everything I wanted to ask, {name}. "
        "Thanks so much for taking the time — really appreciate your thoughts. Take care."
    )


class ResearchOrchestrator:
    """Deterministic question flow + bounded composer LLM per spoken turn."""

    def __init__(
        self,
        session: SessionState,
        base_url: str,
        api_key: str,
        model: str,
    ) -> None:
        self._session = session
        self._session_id = session.session_id
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._tracker = QuestionTracker(questions=questions_from_metadata(session.metadata))
        self._closed = False

        md = session.metadata or {}
        self._interviewer_name = (md.get("interviewer_name") or "Alex").strip() or "Alex"
        self._study_title = (md.get("title") or "this study").strip() or "this study"
        self._study_description = (md.get("description") or "").strip() or "your recent experience."

    async def run(self) -> None:
        ws_url = (
            BASE_URL.replace("http://", "ws://").replace("https://", "wss://")
            + f"/agent/{self._session_id}?api_key={API_KEY}"
        )

        try:
            async with websockets.connect(ws_url) as ws:
                logger.info(
                    "[%s] ResearchOrchestrator connected (model=%s, base=%s, n_questions=%d)",
                    self._session_id,
                    self._model,
                    self._base_url,
                    len(self._tracker.questions),
                )
                async for raw in ws:
                    if self._closed:
                        break
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        logger.warning("[%s] Non-JSON from voice service: %s", self._session_id, raw)
                        continue

                    if msg.get("type") != "transcription":
                        continue

                    text = (msg.get("text") or "").strip()
                    if not text:
                        continue

                    reply, end_after = await self._handle_turn(text)
                    payload: dict[str, Any] = {"type": "response", "text": reply}
                    if end_after:
                        payload["end_after"] = True
                    await ws.send(json.dumps(payload))
        except websockets.ConnectionClosed:
            logger.info("[%s] ResearchOrchestrator ws closed", self._session_id)
        except asyncio.CancelledError:
            logger.info("[%s] ResearchOrchestrator cancelled", self._session_id)
            raise
        except Exception as exc:
            logger.exception("[%s] ResearchOrchestrator error: %s", self._session_id, exc)

    def stop(self) -> None:
        self._closed = True

    async def _handle_turn(self, text: str) -> tuple[str, bool]:
        if text == KICKOFF_MARKER:
            return await self._kickoff(), False

        action = self._tracker.record_answer(text)

        if action == "follow_up":
            q = self._tracker.current_question()
            if not q:
                return _farewell_text(self._session), True
            utterance = await compose_utterance(
                base_url=self._base_url,
                api_key=self._api_key,
                model=self._model,
                session_id=self._session_id,
                interviewer_name=self._interviewer_name,
                participant_name=_participant_first_name(self._session),
                question_index_1based=self._tracker.current_index + 1,
                question_total=len(self._tracker.questions),
                current_question=q,
                latest_user_text=text,
                turn_status="follow-up — they were brief; invite a fuller answer, then repeat the same question in fresh words",
            )
            return utterance, False

        prev_question_before_advance = self._tracker.current_question()
        self._tracker.advance_after_answer()
        if self._tracker.is_done():
            return _farewell_text(self._session), True

        q = self._tracker.current_question()
        if not q:
            return _farewell_text(self._session), True

        if action == "advance_force":
            utterance = await compose_utterance(
                base_url=self._base_url,
                api_key=self._api_key,
                model=self._model,
                session_id=self._session_id,
                interviewer_name=self._interviewer_name,
                participant_name=_participant_first_name(self._session),
                question_index_1based=self._tracker.current_index + 1,
                question_total=len(self._tracker.questions),
                current_question=q,
                latest_user_text=text,
                turn_status="advance_force — bridge from brief reply to next scripted question",
                previous_question=prev_question_before_advance,
                previous_brief_answer=text,
            )
        else:
            utterance = await compose_utterance(
                base_url=self._base_url,
                api_key=self._api_key,
                model=self._model,
                session_id=self._session_id,
                interviewer_name=self._interviewer_name,
                participant_name=_participant_first_name(self._session),
                question_index_1based=self._tracker.current_index + 1,
                question_total=len(self._tracker.questions),
                current_question=q,
                latest_user_text=text,
                turn_status="first pass on this scripted question after their answer",
            )
        return utterance, False

    async def _kickoff(self) -> str:
        q0 = self._tracker.current_question()
        if not q0:
            return _farewell_text(self._session)
        return await compose_kickoff(
            base_url=self._base_url,
            api_key=self._api_key,
            model=self._model,
            session_id=self._session_id,
            interviewer_name=self._interviewer_name,
            participant_name=_participant_first_name(self._session),
            study_title=self._study_title,
            study_description=self._study_description,
            first_question=q0,
        )


async def run_research_agent(
    session: SessionState,
    base_url: str,
    api_key: str,
    model: str,
) -> None:
    """Top-level coroutine started by SessionManager for each new session."""
    agent = ResearchOrchestrator(session, base_url, api_key, model)
    await agent.run()
