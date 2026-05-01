"""Single-call LLM composer for one interview utterance at a time."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)


_META_LEAK_PATTERNS = (
    "here's my follow-up",
    "here is my follow-up",
    "my follow-up question",
    "response was brief",
    "response is brief",
    "i'll respond accordingly",
    "i will respond accordingly",
    "they were brief",
    "turn status",
    "planner note",
)

_STOP_TOKENS = frozenset(
    {
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "as", "is", "was", "are", "were", "been", "be", "have", "has",
        "had", "do", "does", "did", "so", "it", "i", "you", "we", "they",
        "this", "that", "these", "those", "just", "like", "um", "uh", "yeah",
        "yes", "no", "okay", "ok", "well", "really", "very", "not", "with",
        "my", "me", "your", "their", "some", "any", "there", "here", "what",
        "when", "how", "why", "who", "which", "about", "from", "into", "up",
        "out", "if", "then", "because", "than", "too", "also", "more", "most",
    }
)


def _meaning_tokens(text: str) -> set[str]:
    words = re.findall(r"[A-Za-z0-9']+", (text or "").lower())
    return {w for w in words if len(w) > 2 and w not in _STOP_TOKENS}


def _looks_like_meta_leak(text: str) -> bool:
    lowered = (text or "").lower()
    return any(p in lowered for p in _META_LEAK_PATTERNS)


def _is_on_script(reply_text: str, current_question: str) -> bool:
    """Require overlap with the current scripted question to prevent drift."""
    reply_tokens = _meaning_tokens(reply_text)
    question_tokens = _meaning_tokens(current_question)
    if not question_tokens:
        return bool(reply_text.strip())
    overlap = reply_tokens.intersection(question_tokens)
    return len(overlap) >= 2


def _deterministic_fallback_utterance(
    current_question: str,
    turn_status: str,
    *,
    previous_question: str | None = None,
    previous_brief_answer: str | None = None,
) -> str:
    if turn_status.startswith("follow-up"):
        return f"Could you say a bit more about that? {current_question}"
    if previous_question:
        return f"Thanks — I'll move on from that. {current_question}"
    return current_question


_SENTENCE_END_RE = re.compile(r"[.!?]\s*$")
_TRAILING_TAIL_MIN_CHARS = (
    20  # fragments shorter than this with no [.!?] are usually max-token cutoffs
)


def _sanitize_spoken_text(raw: str, *, max_sentences: int = 2) -> str:
    text = (raw or "").strip()
    text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<reasoning>[\s\S]*?</reasoning>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^.*?(?:here(?:'| i)s my follow-up:?|my follow-up question:?)[\r\n]+", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = text.strip().strip('"').strip()
    text = " ".join(text.split())
    fragments = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]

    if not fragments:
        return ""

    chosen: list[str] = []
    for frag in fragments:
        if len(chosen) >= max_sentences:
            break
        if _SENTENCE_END_RE.search(frag):
            chosen.append(frag)
            continue
        if not chosen:
            chosen.append(frag)
            break
        if len(frag) >= _TRAILING_TAIL_MIN_CHARS:
            chosen.append(frag)
        break

    return " ".join(chosen).strip()


async def call_llm(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    session_id: str,
    max_tokens: int = 320,
) -> str:
    async def _send_once(target_base_url: str, target_api_key: str, target_model: str) -> str:
        url = f"{target_base_url.rstrip('/')}/chat/completions"
        payload: dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": max_tokens,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {target_api_key or 'none'}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        try:
            return (data["choices"][0]["message"]["content"] or "").strip()
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("[%s] Unexpected LLM response shape: %s", session_id, data)
            raise RuntimeError("invalid llm response") from exc

    try:
        return await _send_once(base_url, api_key, model)
    except Exception as primary_exc:
        fallback_base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
        fallback_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        fallback_api_key = os.getenv("GEMINI_API_KEY", "")
        if not fallback_api_key:
            raise
        if base_url.rstrip("/") == fallback_base_url.rstrip("/"):
            raise
        logger.warning(
            "[%s] Primary LLM request failed; retrying with Gemini fallback: %s",
            session_id,
            primary_exc,
        )
        return await _send_once(fallback_base_url, fallback_api_key, fallback_model)


async def compose_kickoff(
    *,
    base_url: str,
    api_key: str,
    model: str,
    session_id: str,
    interviewer_name: str,
    participant_name: str,
    study_title: str,
    study_description: str,
    first_question: str,
) -> str:
    system = (
        "You are a friendly human research interviewer on a live voice call. "
        "Reply with PLAIN TEXT only — exactly what should be spoken. "
        "No markdown, no bullet points, no emoji, no JSON, no quotes around lines."
    )
    user = f"""Interviewer name to use for yourself: {interviewer_name}
Participant first name: {participant_name}
Study title: {study_title}
Study description (one line): {study_description}

Opening script requirements (exactly three short sentences, spoken aloud):
1) Greet {participant_name} by name and thank them for joining.
2) In one sentence, say who you are ({interviewer_name}) and what this conversation is about (tie to the study title).
3) Ask this first research question verbatim in meaning (you may smooth the wording slightly for speech): "{first_question}"
"""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    try:
        raw = await call_llm(
            base_url=base_url, api_key=api_key, model=model, messages=messages, session_id=session_id
        )
        return _sanitize_spoken_text(raw, max_sentences=3)
    except Exception as exc:
        logger.warning("[%s] compose_kickoff failed: %s", session_id, exc)
        return (
            f"Hi {participant_name}, thanks for joining — I'm {interviewer_name}. "
            f"We're going to chat briefly about {study_title}. "
            f"{first_question}"
        )


async def compose_utterance(
    *,
    base_url: str,
    api_key: str,
    model: str,
    session_id: str,
    interviewer_name: str,
    participant_name: str,
    question_index_1based: int,
    question_total: int,
    current_question: str,
    latest_user_text: str,
    turn_status: str,
    advance_hint: str | None = None,
    previous_question: str | None = None,
    previous_brief_answer: str | None = None,
) -> str:
    """One bounded LLM call: acknowledgement + ask the current scripted question."""
    is_follow_up = turn_status.startswith("follow-up")
    is_advance_force_bridge = bool(previous_question)

    if is_follow_up:
        system = (
            "You are a friendly human research interviewer on a live voice call. "
            "Reply with PLAIN spoken text only — exactly two short sentences total.\n"
            "Sentence 1 (REQUIRED): briefly invite more detail; reference one concrete word "
            "or phrase from what they just said (not generic thanks).\n"
            "Sentence 2 (REQUIRED): re-ask the same research question below in fresh words; "
            "keep the same intent and key nouns.\n"
            "Do NOT narrate your reasoning, do NOT use labels like 'follow-up', "
            "do NOT add a third sentence, no markdown, no JSON."
        )
        user = f"""You are {interviewer_name}. The participant is {participant_name}.
You are still on scripted question {question_index_1based} of {question_total} (same question as before).

The question to re-ask (same intent; rephrase for speech only):
"{current_question}"

They just said (brief):
"{latest_user_text}"
"""
    elif is_advance_force_bridge:
        system = (
            "You are a friendly human research interviewer on a live voice call. "
            "Reply with PLAIN spoken text only — exactly two short sentences total.\n"
            "Sentence 1 (REQUIRED): briefly acknowledge their last reply with one concrete "
            "detail from it (or from the previous topic); do not re-ask the old question.\n"
            "Sentence 2 (REQUIRED): ask the NEW scripted question below, almost verbatim; "
            "keep intent and key nouns.\n"
            "Do NOT narrate your reasoning, do NOT use labels, no markdown, no JSON."
        )
        user = f"""You are {interviewer_name}. The participant is {participant_name}.
You are now on scripted question {question_index_1based} of {question_total}.

We are moving on after a brief answer. The previous question was:
"{previous_question}"

Their last reply was:
"{previous_brief_answer or '(brief reply)'}"

The NEW question to ask now (almost verbatim in meaning):
"{current_question}"
"""
    else:
        system = (
            "You are a friendly human research interviewer on a live voice call. "
            "Reply with PLAIN spoken text only — exactly two short sentences total.\n"
            "Sentence 1 (REQUIRED): a brief acknowledgement that references a concrete word "
            "or detail from what they just said (not generic 'got it' or 'thanks').\n"
            "Sentence 2 (REQUIRED): ask the scripted question below, almost verbatim; "
            "you may smooth phrasing for speech but keep intent and key nouns.\n"
            "Do NOT narrate your reasoning, do NOT use labels like 'follow-up', "
            "do NOT introduce a new topic, do NOT add extra sentences. "
            "No markdown, no bullet points, no emoji, no JSON."
        )
        hint = f"\nPlanner note: {advance_hint}" if advance_hint else ""
        user = f"""You are {interviewer_name}. The participant is {participant_name}.
You are on scripted question {question_index_1based} of {question_total}.

The question you must ask (preserve intent; natural spoken wording is OK):
"{current_question}"

They just said:
"{latest_user_text}"

Turn status: {turn_status}{hint}
"""

    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    try:
        raw = await call_llm(
            base_url=base_url, api_key=api_key, model=model, messages=messages, session_id=session_id
        )
        spoken = _sanitize_spoken_text(raw, max_sentences=2)
        if not spoken or _looks_like_meta_leak(spoken) or not _is_on_script(spoken, current_question):
            logger.warning(
                "[%s] compose_utterance validation failed; using deterministic fallback. raw=%r sanitized=%r",
                session_id,
                raw,
                spoken,
            )
            return _deterministic_fallback_utterance(
                current_question,
                turn_status,
                previous_question=previous_question,
                previous_brief_answer=previous_brief_answer,
            )
        return spoken
    except Exception as exc:
        logger.warning("[%s] compose_utterance failed: %s", session_id, exc)
        return _deterministic_fallback_utterance(
            current_question,
            turn_status,
            previous_question=previous_question,
            previous_brief_answer=previous_brief_answer,
        )
