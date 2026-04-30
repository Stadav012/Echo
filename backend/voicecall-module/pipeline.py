import asyncio
import json as _json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    InputAudioRawFrame,
    InterruptionFrame,
    OutputAudioRawFrame,
    TextFrame,
    TranscriptionFrame,
    VADUserStartedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.serializers.base_serializer import FrameSerializer
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService, LiveOptions
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

from config import (
    CARTESIA_API_KEY,
    CARTESIA_MODEL,
    CARTESIA_VOICE_ID,
    DEEPGRAM_API_KEY,
)
from models import SessionState

if TYPE_CHECKING:
    from session_manager import SessionManager

logger = logging.getLogger(__name__)

TRANSCRIPTS_DIR = Path(__file__).parent / "transcripts"
FALLBACK_RESPONSE = "I'm sorry, I didn't receive a response. Could you repeat that?"


# ---------------------------------------------------------------------------
# Serializer — raw PCM audio + JSON control messages to the browser
# ---------------------------------------------------------------------------

class RawAudioSerializer(FrameSerializer):
    """
    Binary:  OutputAudioRawFrame  → raw PCM bytes  (browser plays these)
    Text:    InterruptionFrame    → {"type":"interrupt"}  (browser flushes queue)
    Receive: raw bytes            → InputAudioRawFrame    (mic audio from browser)
    """

    async def serialize(self, frame) -> bytes | str | None:
        if isinstance(frame, OutputAudioRawFrame):
            return frame.audio
        if isinstance(frame, InterruptionFrame):
            return _json.dumps({"type": "interrupt"})
        return None

    async def deserialize(self, data) -> object | None:
        if isinstance(data, (bytes, bytearray)):
            return InputAudioRawFrame(
                audio=bytes(data),
                sample_rate=16000,
                num_channels=1,
            )
        # Browser detected speech locally and is telling us to stop TTS now
        if isinstance(data, str):
            try:
                msg = _json.loads(data)
                if msg.get("type") == "user_speaking":
                    return InterruptionFrame()
            except (ValueError, KeyError):
                pass
        return None


# ---------------------------------------------------------------------------
# Debug processor
# ---------------------------------------------------------------------------

class AudioDebugger(FrameProcessor):
    def __init__(self, session_id: str) -> None:
        super().__init__()
        self._session_id = session_id
        self._count = 0

    async def process_frame(self, frame: object, direction: FrameDirection) -> None:  # type: ignore[override]
        await super().process_frame(frame, direction)
        if isinstance(frame, InputAudioRawFrame):
            self._count += 1
            if self._count % 50 == 0:
                logger.info(
                    "[%s] Audio from browser: frame #%d (%d bytes)",
                    self._session_id, self._count, len(frame.audio),
                )
        await self.push_frame(frame, direction)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _transcript_path(session_id: str) -> Path:
    TRANSCRIPTS_DIR.mkdir(exist_ok=True)
    return TRANSCRIPTS_DIR / f"{session_id}.txt"


def _write_line(path: Path, role: str, text: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"[{ts}] {role.upper()}: {text}\n")


# ---------------------------------------------------------------------------
# Backend relay — FSM states: IDLE / PROCESSING
# ---------------------------------------------------------------------------

class BackendRelayProcessor(FrameProcessor):
    """
    Finite-state relay between the customer and the external backend (LLM).

    IDLE        — waiting for the customer to speak
    PROCESSING  — a TranscriptionFrame has been sent to the backend; waiting
                  for a response TextFrame to push to TTS

    Transitions:
      IDLE       → PROCESSING  on TranscriptionFrame
      PROCESSING → IDLE        on response received (or timeout / fallback)
      PROCESSING → IDLE        on InterruptionFrame (customer barged in)
        ↳ cancels the in-flight backend request so we don't speak over them

    When interrupted:
      - The pending _respond task is cancelled immediately.
      - InterruptionFrame is forwarded downstream so CartesiaTTSService and
        the transport output also stop and flush.
    """

    _STATE_IDLE       = "idle"
    _STATE_PROCESSING = "processing"

    def __init__(
        self,
        session_id: str,
        transcript_file: Path,
        manager: "SessionManager",
    ) -> None:
        super().__init__()
        self._session_id    = session_id
        self._transcript    = transcript_file
        self._manager       = manager
        self._state         = self._STATE_IDLE
        self._pending: asyncio.Task | None = None

    async def process_frame(self, frame: object, direction: FrameDirection) -> None:  # type: ignore[override]
        await super().process_frame(frame, direction)

        # ── Barge-in: customer started speaking ──────────────────────────
        if isinstance(frame, (InterruptionFrame, VADUserStartedSpeakingFrame)):
            if self._state == self._STATE_PROCESSING and self._pending:
                self._pending.cancel()
                logger.info("[%s] INTERRUPTED — response cancelled", self._session_id)
            self._state = self._STATE_IDLE
            # Forward so TTS + transport output also flush
            await self.push_frame(frame, direction)

        # ── Customer finished speaking: new transcription ─────────────────
        elif isinstance(frame, TranscriptionFrame) and frame.text.strip():
            text = frame.text.strip()
            logger.info("[%s] CUSTOMER SAID: %s", self._session_id, text)
            await asyncio.to_thread(_write_line, self._transcript, "customer", text)

            self._state   = self._STATE_PROCESSING
            self._pending = asyncio.create_task(self._respond(text))

        else:
            await self.push_frame(frame, direction)

    async def _respond(self, text: str) -> None:
        try:
            sent = await self._manager.send_transcription_to_agent(self._session_id, text)
            if sent:
                response = await self._manager.get_agent_response(
                    self._session_id, timeout=10.0
                )
                if response is None:
                    logger.warning("[%s] Backend timed out", self._session_id)
                    response = FALLBACK_RESPONSE
            else:
                logger.warning("[%s] No backend connected", self._session_id)
                response = FALLBACK_RESPONSE

            # Brief human-like pause before speaking — also a cancellation point
            # so a barge-in during this window still cancels the response.
            await asyncio.sleep(0.4)

            logger.info("[%s] AGENT REPLIES: %s", self._session_id, response)
            await asyncio.to_thread(_write_line, self._transcript, "agent", response)
            await self.push_frame(TextFrame(response))

        except asyncio.CancelledError:
            logger.info("[%s] _respond task cancelled (barge-in)", self._session_id)
            raise
        finally:
            self._state = self._STATE_IDLE


# ---------------------------------------------------------------------------
# Pipeline factory
# ---------------------------------------------------------------------------

async def create_pipeline_task(
    session: SessionState,
    websocket: object,
    manager: "SessionManager",
) -> PipelineTask:
    transcript_file = _transcript_path(session.session_id)

    await asyncio.to_thread(
        _write_line, transcript_file, "system",
        f"Session started — customer_id={session.customer_id} name={session.customer_name}",
    )

    transport = FastAPIWebsocketTransport(
        websocket=websocket,  # type: ignore[arg-type]
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_enabled=True,
            audio_out_sample_rate=16000,
            serializer=RawAudioSerializer(),
        ),
    )

    stt = DeepgramSTTService(
        api_key=DEEPGRAM_API_KEY,
        live_options=LiveOptions(
            language="en",
            model="nova-2",
            endpointing=300,
        ),
    )

    tts = CartesiaTTSService(
        api_key=CARTESIA_API_KEY,
        voice_id=CARTESIA_VOICE_ID,
        model=CARTESIA_MODEL,
        sample_rate=16000,
        encoding="pcm_s16le",
    )

    vad = VADProcessor(
        vad_analyzer=SileroVADAnalyzer(
            params=VADParams(
                confidence=0.5,
                start_secs=0.2,
                stop_secs=0.5,
                min_volume=0.3,
            )
        )
    )

    pipeline = Pipeline(
        [
            transport.input(),
            AudioDebugger(session.session_id),
            vad,
            stt,
            BackendRelayProcessor(session.session_id, transcript_file, manager),
            tts,
            transport.output(),
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=False,
        ),
    )

    manager.register_pipeline(session.session_id, task)
    return task


async def run_pipeline(
    session: SessionState,
    websocket: object,
    manager: "SessionManager",
) -> None:
    try:
        task = await create_pipeline_task(session, websocket, manager)
        runner = PipelineRunner()
        await runner.run(task)
    except Exception as exc:
        logger.exception("Pipeline error for session %s: %s", session.session_id, exc)
    finally:
        manager.remove_pipeline(session.session_id)
        await manager.update_status(session.session_id, "completed")
        await manager.send_callback(session.session_id)
        logger.info("Pipeline finished for session %s", session.session_id)
