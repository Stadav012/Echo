"""Deterministic question-bank tracker for voice interviews (no LLM)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal

AnswerAction = Literal["follow_up", "advance", "advance_force"]

_STOPWORDS = frozenset(
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


def is_substantial_answer(text: str, *, min_non_trivial: int = 5, min_total_words: int = 8) -> bool:
    """Heuristic: enough content to treat as an answer to the current question."""
    raw = (text or "").strip()
    if not raw:
        return False
    words = re.findall(r"[A-Za-z0-9']+", raw.lower())
    if len(words) >= min_total_words:
        return True
    non_trivial = [w for w in words if w not in _STOPWORDS and len(w) > 1]
    return len(non_trivial) >= min_non_trivial


def questions_from_metadata(metadata: dict[str, Any] | None) -> list[str]:
    """Build ordered question list from session metadata (refined bank or fallback)."""
    md = metadata or {}
    summary = md.get("refinement_summary") or {}
    if isinstance(summary, dict):
        improved = summary.get("improved_questions")
        if isinstance(improved, list) and improved:
            out = [str(q).strip() for q in improved if str(q).strip()]
            if out:
                return out[:12]

    qb = md.get("question_bank_text")
    if isinstance(qb, str) and qb.strip():
        lines = [ln.strip() for ln in qb.splitlines() if ln.strip()]
        candidates = [ln for ln in lines if len(ln) > 12][:8]
        if candidates:
            return candidates

    title = (md.get("title") or "this study").strip()
    return [
        f"What first drew you to participate in {title}?",
        "What stood out to you in the early experience?",
        "What would have made things easier for you?",
    ]


@dataclass
class QuestionTracker:
    """Tracks which scripted question we are on and when to advance."""

    questions: list[str]
    current_index: int = 0
    follow_ups_used: int = 0
    notes_per_question: dict[int, list[str]] = field(default_factory=dict)

    MAX_FOLLOWUPS_PER_Q: int = 1

    def current_question(self) -> str | None:
        if self.current_index < 0 or self.current_index >= len(self.questions):
            return None
        return self.questions[self.current_index]

    def is_done(self) -> bool:
        return self.current_index >= len(self.questions)

    def record_answer(self, text: str) -> AnswerAction:
        """Classify the participant's latest utterance for the current question slot."""
        if is_substantial_answer(text):
            self._append_note(self.current_index, text)
            return "advance"

        if self.follow_ups_used < self.MAX_FOLLOWUPS_PER_Q:
            self.follow_ups_used += 1
            return "follow_up"

        self._append_note(self.current_index, text)
        return "advance_force"

    def advance_after_answer(self) -> None:
        """Move to the next question after a turn that ends with advance or advance_force."""
        self.current_index += 1
        self.follow_ups_used = 0

    def _append_note(self, q_index: int, text: str) -> None:
        slot = self.notes_per_question.setdefault(q_index, [])
        snippet = text.strip()[:200]
        if snippet:
            slot.append(snippet)
