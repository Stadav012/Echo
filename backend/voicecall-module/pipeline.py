import asyncio
import itertools
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    InputAudioRawFrame,
    OutputAudioRawFrame,
    TextFrame,
    TranscriptionFrame,
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

DUMMY_RESPONSES_PATH = Path(__file__).parent / "dummy_responses.txt"
TRANSCRIPTS_DIR = Path(__file__).parent / "transcripts"


# ---------------------------------------------------------------------------
# Raw PCM serializer — browser sends/receives plain binary, no protobuf
# ---------------------------------------------------------------------------

class RawAudioSerializer(FrameSerializer):
    """Pass raw PCM bytes straight through in both directions."""

    async def serialize(self, frame) -> bytes | None:
        if isinstance(frame, OutputAudioRawFrame):
            return frame.audio
        return None

    async def deserialize(self, data) -> InputAudioRawFrame | None:
        if isinstance(data, (bytes, bytearray)):
            return InputAudioRawFrame(
                audio=bytes(data),
                sample_rate=16000,
                num_channels=1,
            )
        return None


# ---------------------------------------------------------------------------
# Debug processor — logs every 50th audio frame so we can confirm mic → server
# ---------------------------------------------------------------------------

class AudioDebugger(FrameProcessor):
    """Logs periodically so we can confirm audio is arriving from the browser."""

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
                    self._session_id,
                    self._count,
                    len(frame.audio),
                )
        await self.push_frame(frame, direction)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_dummy_lines() -> list[str]:
    with open(DUMMY_RESPONSES_PATH, "r") as f:
        lines = [l.strip() for l in f if l.strip()]
    if not lines:
        raise RuntimeError(f"{DUMMY_RESPONSES_PATH} is empty")
    return lines


def _transcript_path(session_id: str) -> Path:
    TRANSCRIPTS_DIR.mkdir(exist_ok=True)
    return TRANSCRIPTS_DIR / f"{session_id}.txt"


def _write_line(path: Path, role: str, text: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"[{ts}] {role.upper()}: {text}\n")


# ---------------------------------------------------------------------------
# Dummy responder (replaces LLM for testing)
# ---------------------------------------------------------------------------

class DummyTextResponder(FrameProcessor):
    """
    Intercepts TranscriptionFrames (customer speech), writes them to a
    per-session transcript file, then replies with the next line from
    dummy_responses.txt as a TextFrame for Cartesia TTS to synthesise.
    """

    def __init__(
        self,
        session_id: str,
        dummy_lines: list[str],
        transcript_file: Path,
    ) -> None:
        super().__init__()
        self._session_id = session_id
        self._responses = itertools.cycle(dummy_lines[1:] or dummy_lines)
        self._transcript_file = transcript_file

    async def process_frame(self, frame: object, direction: FrameDirection) -> None:  # type: ignore[override]
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            text = frame.text.strip()
            logger.info("[%s] CUSTOMER SAID: %s", self._session_id, text)
            await asyncio.to_thread(_write_line, self._transcript_file, "customer", text)

            response = next(self._responses)
            logger.info("[%s] AGENT REPLIES: %s", self._session_id, response)
            await asyncio.to_thread(_write_line, self._transcript_file, "agent", response)
            await self.push_frame(TextFrame(response))
        else:
            await self.push_frame(frame, direction)


# ---------------------------------------------------------------------------
# Pipeline factory
# ---------------------------------------------------------------------------

async def create_pipeline_task(
    session: SessionState,
    websocket: object,
    manager: "SessionManager",
) -> PipelineTask:
    dummy_lines = await asyncio.to_thread(_load_dummy_lines)
    transcript_file = _transcript_path(session.session_id)

    await asyncio.to_thread(
        _write_line,
        transcript_file,
        "system",
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

    # Lower VAD thresholds so regular mic volume is detected
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

    audio_debugger = AudioDebugger(session.session_id)
    responder = DummyTextResponder(session.session_id, dummy_lines, transcript_file)

    pipeline = Pipeline(
        [
            transport.input(),
            audio_debugger,   # confirms mic audio is arriving
            vad,
            stt,
            responder,
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

    # Send the opening greeting immediately
    opening = dummy_lines[0]
    logger.info("[%s] AGENT (greeting): %s", session.session_id, opening)
    await asyncio.to_thread(_write_line, transcript_file, "agent", opening)
    await task.queue_frames([TextFrame(opening)])

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
