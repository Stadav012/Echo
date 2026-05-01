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

# LLM backend used by ResearchAgent.
# Provider defaults:
#   - qwen  -> DashScope compatible endpoint
#   - gemini -> Google OpenAI-compatible endpoint
#   - other -> local Ollama fallback
LLM_PROVIDER: str = _optional("LLM_PROVIDER", "qwen").lower()
QWEN_API_KEY: str = os.getenv("QWEN_API_KEY") or os.getenv("qwen_api_key", "")
GEMINI_API_KEY: str = _optional("GEMINI_API_KEY", "")
QWEN_MODEL: str = _optional("QWEN_MODEL", "qwen-vl-max")
GEMINI_MODEL: str = _optional("GEMINI_MODEL", "gemini-2.5-flash")

if LLM_PROVIDER == "qwen":
    _default_base = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    _default_model = QWEN_MODEL
    _default_api_key = QWEN_API_KEY
elif LLM_PROVIDER == "gemini":
    _default_base = "https://generativelanguage.googleapis.com/v1beta/openai"
    _default_model = GEMINI_MODEL
    _default_api_key = GEMINI_API_KEY
else:
    _default_base = "http://localhost:11434/v1"
    _default_model = "llama3.2:1b"
    _default_api_key = "ollama"

LLM_BASE_URL: str = _optional("LLM_BASE_URL", _default_base).rstrip("/")
LLM_API_KEY: str = _optional("LLM_API_KEY", _default_api_key)
LLM_MODEL: str = _optional("LLM_MODEL", _default_model)

BASE_URL: str = _optional("BASE_URL", "http://localhost:8000").rstrip("/")
API_KEY: str = _require("API_KEY")
SESSION_TIMEOUT_SECONDS: int = int(_optional("SESSION_TIMEOUT_SECONDS", "300"))

CALLBACK_SECRET: str = _require("CALLBACK_SECRET")

REDIS_URL: str = _optional("REDIS_URL", "")
