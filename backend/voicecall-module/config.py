import os
from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Required environment variable '{key}' is not set")
    return value


def _optional(key: str, default: str = "") -> str:
    return os.getenv(key, default)


DEEPGRAM_API_KEY: str = _require("DEEPGRAM_API_KEY")
CARTESIA_API_KEY: str = _require("CARTESIA_API_KEY")
CARTESIA_VOICE_ID: str = _require("CARTESIA_VOICE_ID")
CARTESIA_MODEL: str = _optional("CARTESIA_MODEL", "sonic-2")
OPENAI_API_KEY: str = _optional("OPENAI_API_KEY")
ANTHROPIC_API_KEY: str = _optional("ANTHROPIC_API_KEY")
LLM_PROVIDER: str = _optional("LLM_PROVIDER", "openai")

BASE_URL: str = _optional("BASE_URL", "http://localhost:8000").rstrip("/")
API_KEY: str = _require("API_KEY")
SESSION_TIMEOUT_SECONDS: int = int(_optional("SESSION_TIMEOUT_SECONDS", "300"))

CALLBACK_SECRET: str = _require("CALLBACK_SECRET")

REDIS_URL: str = _optional("REDIS_URL", "")
