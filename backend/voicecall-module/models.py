from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    """Create-session payload from the calling backend.

    The `metadata` field is free-form, but the ResearchOrchestrator in agent.py
    reads the following well-known keys (all optional except where noted):

    - research_campaign_id (str): id of the research_campaigns row in Supabase.
    - contact_id (str): id of the contact_list row this call targets.
    - title (str): research campaign title; used in the agent's system prompt.
    - description (str): research campaign description.
    - interviewer_name (str): display name the interviewer uses for themselves
      in spoken greetings (default: Alex).
    - question_bank_text (str | null): original typed question bank, used as a
      fallback if no refinement summary is available.
    - refinement_summary (object | null): output of /api/refine/finalize. The
      agent uses these subfields:
        * improved_questions (string[]): primary question source.
        * key_themes (string[]): surfaced as guidance.
        * notes (string): researcher-facing change notes.
    - contact (object | null): denormalised contact info to personalise the
      conversation. Recognised subfields: name, age, occupation.
    """

    customer_id: str
    customer_name: str
    context: str
    callback_url: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class CreateSessionResponse(BaseModel):
    session_id: str
    talk_url: str
    expires_at: str  # ISO8601


class TranscriptEntry(BaseModel):
    role: str
    text: str
    timestamp: str  # ISO8601


class SessionState(BaseModel):
    session_id: str
    customer_id: str
    customer_name: str
    context: str
    callback_url: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: Literal["pending", "active", "completed", "expired"] = "pending"
    transcript: list[TranscriptEntry] = Field(default_factory=list)
    created_at: datetime
    expires_at: datetime


class SessionStatusResponse(BaseModel):
    session_id: str
    status: str
    transcript: list[TranscriptEntry]
