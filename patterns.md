# Software Engineering Patterns In This Codebase

Brief examples of patterns currently used.

## 1) Singleton (module-level shared instance)

`SessionManager` is instantiated once and reused by all routes.

```python
# backend/voicecall-module/main.py
session_manager = SessionManager()

app = FastAPI(title="Voice Agent", lifespan=lifespan)
```

This is effectively a process-level singleton for session lifecycle state.

Why used: there must be one coherent in-memory source of truth for sessions, pipelines, and websocket registries during a server process.

## 2) Factory Method (object graph construction)

`create_pipeline_task()` builds and wires the full voice pipeline (transport, VAD, STT, relay, TTS, watchdog) and returns a configured `PipelineTask`.

```python
# backend/voicecall-module/pipeline.py
async def create_pipeline_task(... ) -> PipelineTask:
    transport = FastAPIWebsocketTransport(...)
    stt = DeepgramSTTService(...)
    tts = CartesiaTTSService(...)
    vad = VADProcessor(...)

    pipeline = Pipeline([
        transport.input(),
        AudioDebugger(session.session_id),
        vad,
        stt,
        BackendRelayProcessor(session.session_id, transcript_file, manager),
        tts,
        BotSpeakingWatchdog(session.session_id, manager),
        transport.output(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(...))
    manager.register_pipeline(session.session_id, task)
    return task
```

Why used: pipeline setup has many moving parts; centralizing construction prevents inconsistent wiring and makes runtime creation repeatable.

## 3) State Machine (explicit states + transitions)

`BackendRelayProcessor` uses explicit states to enforce half-duplex behavior.

```python
# backend/voicecall-module/pipeline.py
_STATE_IDLE = "idle"
_STATE_PROCESSING = "processing"

if self._state == self._STATE_PROCESSING:
    logger.info("Ignoring late transcription while agent is speaking")
    return

self._state = self._STATE_PROCESSING
self._pending = asyncio.create_task(self._respond(...))
...
finally:
    self._state = self._STATE_IDLE
```

Why used: explicit states avoid race conditions and accidental barge-in by controlling exactly when user transcriptions are accepted.

## 4) Strategy Pattern (pluggable heuristics / behavior)

`QuestionTracker.record_answer()` selects behavior (`follow_up`, `advance`, `advance_force`) based on a heuristic strategy (`is_substantial_answer`).

```python
# backend/voicecall-module/agent_state.py
def record_answer(self, text: str) -> AnswerAction:
    if is_substantial_answer(text):
        return "advance"
    if self.follow_ups_used < self.MAX_FOLLOWUPS_PER_Q:
        self.follow_ups_used += 1
        return "follow_up"
    return "advance_force"
```

The orchestrator then applies different turn strategies based on the returned action.

Why used: interview pacing rules can evolve independently from orchestration and LLM prompting, so decision logic stays testable and deterministic.

## 5) Observer / Event-Driven Messaging

Components communicate through events/messages (WebSocket + frame events), not direct tight coupling.

```python
# backend/voicecall-module/pipeline.py
if isinstance(frame, BotStartedSpeakingFrame):
    await self._manager.send_browser_message(
        self._session_id, {"type": "agent_speaking", "speaking": True}
    )
elif isinstance(frame, BotStoppedSpeakingFrame):
    await self._manager.send_browser_message(
        self._session_id, {"type": "agent_speaking", "speaking": False}
    )
    self._manager.signal_bot_speaking_done(self._session_id)
```

And route-level relay:

```python
# backend/voicecall-module/main.py
async for msg in websocket.iter_json():
    if msg.get("type") == "response" and msg.get("text"):
        session_manager.put_agent_response(
            session_id, msg["text"], end_after=bool(msg.get("end_after"))
        )
```

Why used: asynchronous event boundaries decouple pipeline/audio timing from agent response timing, which improves resilience and simplifies component responsibilities.

