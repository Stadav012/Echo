# Voice Agent Module

Session-based voice agent system built with FastAPI, Pipecat, Deepgram (STT), and Cartesia (TTS).

Currently running in **test mode**: the agent replies with lines from `dummy_responses.txt` instead of a live LLM. Customer speech is saved to `transcripts/{session_id}.txt`.

---

## Prerequisites

- Python 3.11+
- A [Deepgram](https://deepgram.com) API key (for speech-to-text)
- A [Cartesia](https://cartesia.ai) API key + voice ID (for text-to-speech)

---

## 1. Environment setup

```bash
cd backend/voicecall-module

# Activate the existing venv (already created)
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

```env
DEEPGRAM_API_KEY=...
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=...
BASE_URL=http://localhost:8000
API_KEY=any-secret-you-choose
CALLBACK_SECRET=any-secret-you-choose
```

> `CARTESIA_MODEL` defaults to `sonic-2` if left blank.  
> `SESSION_TIMEOUT_SECONDS` defaults to `300` (5 minutes).  
> Leave `REDIS_URL` blank to use the in-memory session store.

---

## 3. Run the server

```bash
uvicorn main:app --reload --port 8000
```

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

---

## 4. Create a test session

In a second terminal (with the venv active), run:

```bash
curl -s -X POST http://localhost:8000/sessions/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "customer_id": "test_001",
    "customer_name": "Tendai",
    "context": "Test session",
    "callback_url": "http://localhost:8000/health",
    "metadata": {}
  }' | python3 -m json.tool
```

You'll get back:

```json
{
  "session_id": "f47ac10b-...",
  "talk_url": "http://localhost:8000/talk/f47ac10b-...",
  "expires_at": "2026-04-29T10:05:00Z"
}
```

---

## 5. Open the voice UI

Open the `talk_url` from step 4 in your browser:

```
http://localhost:8000/talk/<session_id>
```

- Click **Allow Microphone** when prompted.
- The agent will immediately greet you with the first line from `dummy_responses.txt`.
- Speak — Deepgram transcribes your words, and the agent replies with the next dummy line via Cartesia TTS.

---

## 6. Check the transcript

Customer speech and agent replies are written to a file as the conversation happens:

```bash
cat transcripts/<session_id>.txt
```

Example output:

```
[2026-04-29T10:00:00Z] SYSTEM: Session started — customer_id=test_001 name=Tendai
[2026-04-29T10:00:01Z] AGENT: Hello! Thanks for reaching out. How can I help you today?
[2026-04-29T10:00:08Z] CUSTOMER: I need to reset my PIN.
[2026-04-29T10:00:08Z] AGENT: Sure, I can help you with that. Could you give me a bit more detail?
```

---

## 7. Other useful endpoints

```bash
# Health check — also shows active session count
curl http://localhost:8000/health

# Poll session status + full transcript (requires API key)
curl http://localhost:8000/sessions/<session_id> \
  -H "X-API-Key: your_api_key"
```

---

## Configuration reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEEPGRAM_API_KEY` | Yes | — | Deepgram STT key |
| `CARTESIA_API_KEY` | Yes | — | Cartesia TTS key |
| `CARTESIA_VOICE_ID` | Yes | — | Cartesia voice ID |
| `CARTESIA_MODEL` | No | `sonic-2` | Cartesia model (`sonic-2` or `sonic-english`) |
| `BASE_URL` | No | `http://localhost:8000` | Public base URL (change when deploying) |
| `API_KEY` | Yes | — | Secret for `/sessions/create` and `/sessions/{id}` |
| `SESSION_TIMEOUT_SECONDS` | No | `300` | Session TTL in seconds |
| `CALLBACK_SECRET` | Yes | — | HMAC-SHA256 secret for signing callback payloads |
| `REDIS_URL` | No | — | Redis connection URL; omit to use in-memory store |

---

## Architecture

```
POST /sessions/create  →  SessionManager  →  returns { session_id, talk_url }
GET  /talk/{id}        →  serves static/talk.html with SESSION_ID injected
WS   /ws/{id}          →  Pipecat pipeline:
                              Deepgram STT
                                  ↓
                              DummyTextResponder   ← reads dummy_responses.txt
                                  ↓                  writes transcripts/{id}.txt
                              Cartesia TTS
GET  /sessions/{id}    →  returns current status + transcript
```

Each WebSocket connection gets its own isolated pipeline. On disconnect the session is marked completed and a signed callback is POSTed to `callback_url`.

---

## File layout

```
voicecall-module/
├── main.py                  # FastAPI app + all routes
├── pipeline.py              # Pipecat pipeline (test mode: DummyTextResponder)
├── session_manager.py       # Session lifecycle, storage, callbacks
├── config.py                # Env var loading
├── models.py                # Pydantic models
├── dummy_responses.txt      # Agent replies used in test mode
├── transcripts/             # Created automatically; one .txt per session
├── static/
│   └── talk.html            # Browser voice UI
├── .env.example             # Env var template
└── requirements.txt
```
