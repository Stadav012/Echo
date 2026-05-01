# Voice Agent Module

Session-based voice agent system built with FastAPI, Pipecat, Deepgram (STT), and Cartesia (TTS).

The browser UI shows a welcome card, asks for microphone permission only when the participant is ready, then plays back TTS audio half-duplex (no barge-in) and renders each question as a chat bubble.

The voice service spawns an in-process **ResearchOrchestrator** ([`agent.py`](agent.py)) for every new session. A **deterministic question tracker** ([`agent_state.py`](agent_state.py)) walks `refinement_summary.improved_questions` in order (with one optional follow-up per question when answers are too short). A **composer** ([`agent_composer.py`](agent_composer.py)) makes a single small Ollama call per turn to phrase the current scripted question naturally. When the bank is exhausted, the orchestrator speaks a fixed farewell and sends `end_after: true` so the pipeline ends the session and fires the callback. The default LLM is a local Ollama instance so the system works offline with no paid API keys.

`agent_test_client.py` and `dummy_responses.txt` are kept around as a manual smoke-test harness only; they are no longer part of the runtime path.

---

## Prerequisites

- Python 3.11+
- **Deepgram API key** — sign up at [console.deepgram.com](https://console.deepgram.com) → *Create API Key*
- **Cartesia API key + Voice ID** — sign up at [play.cartesia.ai](https://play.cartesia.ai) → *API Keys* tab; pick a voice from the *Voice Library* and copy its ID
- **Ollama** (default LLM) — install with `brew install ollama` (macOS) or follow [ollama.com/download](https://ollama.com/download). Then in a separate terminal run `ollama serve` and pull a small model once: `ollama pull llama3.2:1b` (~1.3 GB). Any other OpenAI-compatible host (OpenRouter, vLLM, OpenAI) works too — just point `LLM_BASE_URL` at it.

---

## 1. Environment setup

```bash
cd backend/voicecall-module

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

## 2. Configure environment variables

The service loads either `.env.local` or `.env` from this directory. Create whichever you prefer:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
DEEPGRAM_API_KEY=<your Deepgram key>
CARTESIA_API_KEY=<your Cartesia key>
CARTESIA_VOICE_ID=<voice ID from Cartesia Voice Library>
BASE_URL=http://localhost:8000
API_KEY=any-secret-you-choose
CALLBACK_SECRET=any-secret-you-choose

# LLM — defaults below run a local Ollama; works offline, no credits needed.
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.2:1b
```

> `CARTESIA_MODEL` defaults to `sonic-2` if left blank.  
> `SESSION_TIMEOUT_SECONDS` defaults to `300` (5 minutes).  
> Leave `REDIS_URL` blank to use the in-memory session store.  
> `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` configure the in-process ResearchOrchestrator composer. The defaults talk to a local Ollama; to use OpenRouter set `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_API_KEY=<your-or-key>`, and `LLM_MODEL=<openrouter-model>`.

---

## 3. Start the server

In one terminal, make sure Ollama is running and the model is pulled (only needed once):

```bash
ollama serve                # leaves a process running
ollama pull llama3.2:1b     # ~1.3 GB; smaller alternatives: qwen2.5:0.5b, qwen2.5:1.5b
```

In another terminal, start the voice service from inside the activated venv:

```bash
python -m uvicorn main:app --port 8000
```

Expected output:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

---

## 4. Run a research-driven session

There is **no separate worker process** — the ResearchOrchestrator is spawned inside the FastAPI service for each new session. Sessions are normally created by the Next.js frontend (`/api/voice/sessions`) when a researcher clicks _Generate call link_ on a contact, but you can also create one manually:

```bash
curl -s -X POST http://localhost:8000/sessions/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customer_id": "test-contact",
    "customer_name": "Tendai",
    "context": "Mobile onboarding research",
    "callback_url": "http://localhost:3000/api/voice/callback",
    "metadata": {
      "research_campaign_id": "00000000-0000-0000-0000-000000000000",
      "contact_id": "00000000-0000-0000-0000-000000000000",
      "title": "Mobile onboarding research",
      "description": "Understand pain points in first-time setup.",
      "question_bank_text": "1. Walk me through your first day with the app.\n2. ...",
      "refinement_summary": {
        "improved_questions": [
          "Tell me about the moment you decided to try the app.",
          "What confused you most during sign-up?"
        ],
        "key_themes": ["onboarding friction", "value discovery"],
        "notes": "Focus on first 24 hours."
      },
      "contact": { "name": "Tendai", "age": "29", "occupation": "Designer" }
    }
  }' | python3 -m json.tool
```

Open the returned `talk_url` in a browser, click **Allow Microphone**, and the agent will speak first with a greeting + question. Speak back; the agent uses your answers to choose the next adaptive question from the refined question bank.

### Legacy dummy-text harness

`agent_test_client.py` + `dummy_responses.txt` are no longer part of the runtime path. They remain in the directory only as a manual smoke-test for the `/agent/{session_id}` WebSocket protocol; if you run it against a session, it will race the in-process ResearchOrchestrator.

---

## 5. Check the transcript

Each session writes a timestamped log to `transcripts/<session_id>.txt`:

```bash
cat transcripts/<session_id>.txt
```

Example:

```
[2026-04-29T10:00:00Z] SYSTEM: Session started — customer_id=test_001 name=Tendai
[2026-04-29T10:00:08Z] CUSTOMER: I need to reset my PIN.
[2026-04-29T10:00:08Z] AGENT: Sure, I can help you with that. Could you give me a bit more detail?
```

---

## 6. REST & status endpoints

```bash
# Health check — shows active session count
curl http://localhost:8000/health

# Create a session manually (agent_test_client.py does this automatically)
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

# Poll session status + transcript
curl http://localhost:8000/sessions/<session_id> \
  -H "X-API-Key: your_api_key"

# Force-end a live session (researcher / automation; cancels pipeline + callback)
curl -s -X POST http://localhost:8000/sessions/<session_id>/end \
  -H "X-API-Key: your_api_key"
```

---

## 7. Agent WebSocket — `/agent/{session_id}`

This is the integration point for your LLM backend. Authenticate with the query parameter `api_key`.

```
ws://localhost:8000/agent/<session_id>?api_key=<API_KEY>
```

### Messages you receive (server → your backend)

| Type            | Payload                                       | When                           |
| --------------- | --------------------------------------------- | ------------------------------ |
| `transcription` | `{"type": "transcription", "text": "..."}` | Customer finished an utterance |

### Messages you send (your backend → server)

| Type       | Payload                                    | Effect                                                      |
| ---------- | ------------------------------------------ | ----------------------------------------------------------- |
| `response` | `{"type": "response", "text": "...", "end_after": true?}` | Text is forwarded to Cartesia TTS. If `end_after` is true, after playback the session is completed and the signed callback runs (same as participant hang-up). |

### Example interaction

```
← {"type": "transcription", "text": "I need to reset my PIN."}
→ {"type": "response", "text": "Sure — can you confirm the last four digits of your account number?"}
← {"type": "transcription", "text": "It's 4729."}
→ {"type": "response", "text": "Got it, I've found your account. ..."}
```

You can connect at any point after the session is created and before it expires. If no backend is connected when the customer speaks, the pipeline replies with a fallback message and continues waiting.

---

## Configuration reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEEPGRAM_API_KEY` | Yes | — | Deepgram STT key |
| `CARTESIA_API_KEY` | Yes | — | Cartesia TTS key |
| `CARTESIA_VOICE_ID` | Yes | — | Cartesia voice ID |
| `CARTESIA_MODEL` | No | `sonic-2` | Cartesia model (`sonic-2` or `sonic-english`) |
| `BASE_URL` | No | `http://localhost:8000` | Public base URL (change for deployment) |
| `API_KEY` | Yes | — | Secret for `/sessions/create`, `/sessions/{id}`, `/sessions/{id}/end`, and `/agent/{id}` |
| `SESSION_TIMEOUT_SECONDS` | No | `300` | Session TTL in seconds |
| `CALLBACK_SECRET` | Yes | — | HMAC-SHA256 secret for signing callback payloads |
| `REDIS_URL` | No | — | Redis connection URL; omit to use in-memory store |
| `LLM_BASE_URL` | No | `http://localhost:11434/v1` | OpenAI-compatible chat-completions host. Defaults to a local Ollama. |
| `LLM_API_KEY` | No | `ollama` | API key sent as `Authorization: Bearer …`. Ollama ignores it; OpenRouter/OpenAI require a real key. |
| `LLM_MODEL` | No | `llama3.2:1b` | Model name passed to the chat-completions endpoint. |

### Session metadata fields the ResearchOrchestrator reads

`POST /sessions/create` accepts a free-form `metadata` object. The orchestrator recognises these keys (all optional):

| Key | Type | Used for |
|---|---|---|
| `research_campaign_id` | string | round-tripped via callback so the caller can correlate |
| `contact_id` | string | round-tripped via callback |
| `title` | string | study title in kickoff / composer prompts |
| `description` | string | study description in kickoff |
| `interviewer_name` | string | spoken name for the interviewer (default: Alex) |
| `question_bank_text` | string | fallback question list if no refinement summary |
| `refinement_summary.improved_questions` | string[] | primary ordered question bank |
| `refinement_summary.key_themes` | string[] | (reserved; tracker is deterministic today) |
| `refinement_summary.notes` | string | (reserved) |
| `contact.name` / `contact.age` / `contact.occupation` | strings | personalises greetings |

---

## Architecture

```
POST /sessions/create  →  SessionManager.create_session
                              ├── persists SessionState
                              └── spawns ResearchOrchestrator task (agent.py)
                                       │
                                       ▼
                              WS connect → /agent/{id}?api_key=...

GET  /talk/{id}        →  serves static/talk.html (SESSION_ID injected)

WS   /ws/{id}          →  Pipecat pipeline:
                              Browser mic (raw PCM)
                                  ↓
                              VADProcessor (Silero)
                                  ↓
                              Deepgram STT
                                  ↓
                              BackendRelayProcessor   ←──────────────┐
                                  │  on TranscriptionFrame:          │
                                  │  → /agent/{id} WS                │
                                  │  ← waits for response (20s)      │
                                  │  ← also pushes JSON              │
                                  │     {transcript|agent_speaking}  │
                                  │     to the participant page      │
                                  ↓                                  │
                              Cartesia TTS                           │
                                  ↓                              WS  /agent/{id}
                              Browser speakers (PCM)                 │
                                                            ResearchOrchestrator (in-process)
                                                                agent_state.QuestionTracker + agent_composer + LLM_BASE_URL

After accept, `ws_endpoint` schedules `kickoff_agent()` which injects a
synthetic `[CALL_STARTED]` TranscriptionFrame into the pipeline so the
agent speaks first (greeting + first question) before the participant
says anything.

GET  /sessions/{id}    →  status + transcript
```

**Half-duplex turn-taking:** Interruptions are intentionally disabled. The participant page drops mic audio while the agent is speaking, the pipeline runs with `allow_interruptions=False`, and `BackendRelayProcessor` ignores any STT result that arrives while a reply is in flight. The agent finishes each turn before the participant can speak again.

**Browser-side messages:** in addition to raw PCM audio, the `/ws/{id}` socket emits JSON envelopes:

| Type | Payload | Effect on the page |
|---|---|---|
| `transcript` | `{"role":"agent"\|"customer","text":"..."}` | renders a chat bubble |
| `agent_speaking` | `{"speaking": true\|false}` | locks/unlocks the mic input |
| `session_end` | `{}` | closes the session UI |
| `error` | `{"message": "..."}` | shows the error banner |

On disconnect the session is marked completed and a signed HMAC-SHA256 callback is POSTed to the `callback_url` supplied at session creation. The Next.js `/api/voice/callback` route verifies the `X-Signature` header, updates the matching `calls` row, and inserts a `transcripts` row.

---

## File layout

```
voicecall-module/
├── main.py                  # FastAPI app — all HTTP + WebSocket routes
├── pipeline.py              # Pipecat pipeline (VAD → STT → BackendRelay → TTS)
├── agent.py                 # ResearchOrchestrator — deterministic tracker + composer LLM
├── agent_state.py           # QuestionTracker + question list from metadata
├── agent_composer.py        # Single-call Ollama utterance composer
├── session_manager.py       # Session lifecycle, agent WS relay, callbacks, agent task
├── config.py                # Env var loading
├── models.py                # Pydantic models (CreateSessionRequest metadata documented here)
├── agent_test_client.py     # LEGACY — manual smoke test for /agent/{id} WS protocol
├── dummy_responses.txt      # LEGACY — replies cycled by agent_test_client.py
├── transcripts/             # Created automatically; one .txt per session
├── static/
│   └── talk.html            # Browser voice UI (welcome → mic permission → half-duplex chat)
├── .env.example             # Env var template (also accepts .env.local)
└── requirements.txt
```
