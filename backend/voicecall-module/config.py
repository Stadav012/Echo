import os
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).parent
load_dotenv(_HERE / ".env.local", override=False)
load_dotenv(_HERE / ".env", override=False)


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

# LLM backend used by ResearchAgent. Defaults to a local Ollama instance so the
# voice service works offline without paid API credits. Any OpenAI-compatible
# endpoint (Ollama, OpenRouter, OpenAI, vLLM) can be plugged in.
LLM_BASE_URL: str = _optional("LLM_BASE_URL", "http://localhost:11434/v1").rstrip("/")
LLM_API_KEY: str = _optional("LLM_API_KEY", "ollama")
LLM_MODEL: str = _optional("LLM_MODEL", "llama3.2:1b")

BASE_URL: str = _optional("BASE_URL", "http://localhost:8000").rstrip("/")
API_KEY: str = _require("API_KEY")
SESSION_TIMEOUT_SECONDS: int = int(_optional("SESSION_TIMEOUT_SECONDS", "300"))

CALLBACK_SECRET: str = _require("CALLBACK_SECRET")

REDIS_URL: str = _optional("REDIS_URL", "")
