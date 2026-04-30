# Voice Agent Module

Session-based voice agent system built with FastAPI, Pipecat, Deepgram (STT), and Cartesia (TTS).

The browser UI handles microphone capture, plays back TTS audio, and performs local barge-in detection. An external backend (your LLM service) connects over a separate WebSocket to receive customer transcriptions and send back responses. During development you can simulate that backend with `agent_test_client.py`, which cycles replies from `dummy_responses.txt`.

---

## Prerequisites

- Python 3.11+
- **Deepgram API key** — sign up at [console.deepgram.com](https://console.deepgram.com) → *Create API Key*
- **Cartesia API key + Voice ID** — sign up at [play.cartesia.ai](https://play.cartesia.ai) → *API Keys* tab; pick a voice from the *Voice Library* and copy its ID

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

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
DEEPGRAM_API_KEY=<your Deepgram key>
CARTESIA_API_KEY=<your Cartesia key>
CARTESIA_VOICE_ID=<voice ID from Cartesia Voice Library>
BASE_URL=http://localhost:8000
API_KEY=any-secret-you-choose
CALLBACK_SECRET=any-secret-you-choose
```

> `CARTESIA_MODEL` defaults to `sonic-2` if left blank.  
> `SESSION_TIMEOUT_SECONDS` defaults to `300` (5 minutes).  
> Leave `REDIS_URL` blank to use the in-memory session store.

---

## 3. Start the server

```bash
uvicorn main:app --port 8000
```

Expected output:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

---

## 4. Run the dummy-text experiment (two terminals)

This experiment lets you test the full voice pipeline without a real LLM. The `agent_test_client.py` script acts as the backend: it creates a session, connects to the agent WebSocket, and replies to each customer utterance with the next line from `dummy_responses.txt`.

**Terminal 1** — start the server (see step 3 above, keep it running).

**Terminal 2** — run the agent client:

```bash
cd backend/voicecall-module
source venv/bin/activate

python agent_test_client.py
```

The script prints a browser URL:

```
  Open this URL in your browser to start the conversation:

    http://localhost:8000/talk/<session_id>
```

Open that URL, click **Allow Microphone**, and speak. You will:

- See your words transcribed in Terminal 2 (`CUSTOMER ▶ …`)
- Hear the agent reply through your speakers (Cartesia TTS)
- Find both sides logged in `transcripts/agent_client.log`

To use an existing session instead of creating a new one:

```bash
python agent_test_client.py <session_id>
```

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
| `response` | `{"type": "response", "text": "..."}` | Text is forwarded to Cartesia TTS and spoken to the customer |

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
| `API_KEY` | Yes | — | Secret for `/sessions/create`, `/sessions/{id}`, and `/agent/{id}` |
| `SESSION_TIMEOUT_SECONDS` | No | `300` | Session TTL in seconds |
| `CALLBACK_SECRET` | Yes | — | HMAC-SHA256 secret for signing callback payloads |
| `REDIS_URL` | No | — | Redis connection URL; omit to use in-memory store |

---

## Architecture

```
POST /sessions/create  →  SessionManager  →  { session_id, talk_url }

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
                                  │  → sends to /agent/{id} WS      │
                                  │  ← waits for response (10s)     │
                                  ↓                                  │
                              Cartesia TTS                           │
                                  ↓                              WS  /agent/{id}
                              Browser speakers                       │
                                                            Your LLM backend
                                                            (or agent_test_client.py)

GET  /sessions/{id}    →  status + transcript
```

**Barge-in flow:** The browser detects sustained RMS above threshold in `onaudioprocess`, immediately flushes queued TTS audio, and sends `{"type":"user_speaking"}` to the server. The server returns an `InterruptionFrame` which cancels any in-flight backend request and stops Cartesia output.

On disconnect the session is marked completed and a signed HMAC-SHA256 callback is POSTed to the `callback_url` supplied at session creation.

---

## File layout

```
voicecall-module/
├── main.py                  # FastAPI app — all HTTP + WebSocket routes
├── pipeline.py              # Pipecat pipeline (VAD → STT → BackendRelay → TTS)
├── session_manager.py       # Session lifecycle, agent WS relay, callbacks
├── config.py                # Env var loading
├── models.py                # Pydantic models
├── agent_test_client.py     # Simulated LLM backend for local testing
├── dummy_responses.txt      # Replies cycled by agent_test_client.py
├── transcripts/             # Created automatically; one .txt per session
│                            # agent_client.log written by agent_test_client.py
├── static/
│   └── talk.html            # Browser voice UI (mic capture, TTS playback, barge-in)
├── .env.example             # Env var template
└── requirements.txt
```
