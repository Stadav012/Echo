from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
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
