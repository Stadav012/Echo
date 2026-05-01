import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    InputAudioRawFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
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

TRANSCRIPTS_DIR = Path(__file__).parent / "transcripts"
FALLBACK_RESPONSE = "I'm sorry, I didn't receive a response. Could you repeat that?"
KICKOFF_MARKER = "[CALL_STARTED]"


# ---------------------------------------------------------------------------
# Serializer — raw PCM audio + JSON control messages to the browser
# ---------------------------------------------------------------------------

class RawAudioSerializer(FrameSerializer):
    """
    Binary:  OutputAudioRawFrame  → raw PCM bytes  (browser plays these)
    Receive: raw bytes            → InputAudioRawFrame    (mic audio from browser)

    Half-duplex mode: the agent always finishes speaking before the participant
    can speak. We therefore do NOT translate any client-side "user_speaking"
    signal into an InterruptionFrame, and we never emit interrupt JSON.
    """

    async def serialize(self, frame) -> bytes | str | None:
        if isinstance(frame, OutputAudioRawFrame):
            return frame.audio
        return None

    async def deserialize(self, data) -> object | None:
        if isinstance(data, (bytes, bytearray)):
            return InputAudioRawFrame(
                audio=bytes(data),
                sample_rate=16000,
                num_channels=1,
            )
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


class BotSpeakingWatchdog(FrameProcessor):
    """
    Sits between TTS and transport.output(). Pipecat publishes
    BotStartedSpeakingFrame / BotStoppedSpeakingFrame upstream from the
    transport output as TTS audio actually starts/finishes playing — those
    events are the authoritative truth for "is the agent talking right now?"

    On each transition we both:
      - push a JSON message to the participant page so the mic lock flips,
      - signal the per-session asyncio.Event so BackendRelayProcessor's
        _respond can wait for TTS to drain before going idle.
    """

    def __init__(self, session_id: str, manager: "SessionManager") -> None:
        super().__init__()
        self._session_id = session_id
        self._manager = manager

    async def process_frame(self, frame: object, direction: FrameDirection) -> None:  # type: ignore[override]
        await super().process_frame(frame, direction)
        if isinstance(frame, BotStartedSpeakingFrame):
            logger.info("[%s] Bot started speaking", self._session_id)
            await self._manager.send_browser_message(
                self._session_id,
                {"type": "agent_speaking", "speaking": True},
            )
        elif isinstance(frame, BotStoppedSpeakingFrame):
            logger.info("[%s] Bot stopped speaking", self._session_id)
            await self._manager.send_browser_message(
                self._session_id,
                {"type": "agent_speaking", "speaking": False},
            )
            self._manager.signal_bot_speaking_done(self._session_id)
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
    Half-duplex relay between the customer and the in-process ResearchAgent.

    Flow:
      1. STT emits a TranscriptionFrame.
      2. We forward the text to the agent over the /agent WebSocket and wait
         for a reply.
      3. We push the reply text to the browser as a JSON `transcript` message
         (so the question is visible) and to TTS as a TextFrame (so it's
         spoken).

    There is no barge-in: while the agent is speaking, the client must hold the
    mic input. We only process customer transcriptions when we're not already
    waiting on a reply, so any speech that leaks through during agent playback
    is dropped.
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

        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            text = frame.text.strip()
            is_kickoff = text == KICKOFF_MARKER

            if is_kickoff:
                logger.info("[%s] KICKOFF — agent will speak first", self._session_id)
            else:
                if self._state == self._STATE_PROCESSING:
                    logger.info(
                        "[%s] Ignoring late transcription while agent is speaking: %s",
                        self._session_id, text,
                    )
                    return
                logger.info("[%s] CUSTOMER SAID: %s", self._session_id, text)
                await asyncio.to_thread(_write_line, self._transcript, "customer", text)
                await self._manager.append_transcript(self._session_id, "customer", text)
                await self._manager.send_browser_message(
                    self._session_id,
                    {"type": "transcript", "role": "customer", "text": text},
                )

            self._state   = self._STATE_PROCESSING
            self._pending = asyncio.create_task(self._respond(text, is_kickoff=is_kickoff))
        else:
            await self.push_frame(frame, direction)

    async def _respond(self, text: str, is_kickoff: bool = False) -> None:
        try:
            sent = await self._manager.send_transcription_to_agent(self._session_id, text)
            if sent:
                response, end_after = await self._manager.get_agent_response(
                    self._session_id, timeout=20.0
                )
                if response is None:
                    logger.warning("[%s] Backend timed out", self._session_id)
                    response = FALLBACK_RESPONSE
                    end_after = False
            else:
                logger.warning("[%s] No backend connected", self._session_id)
                response = FALLBACK_RESPONSE
                end_after = False

            await asyncio.sleep(0.3)

            logger.info("[%s] AGENT REPLIES: %s", self._session_id, response)
            await asyncio.to_thread(_write_line, self._transcript, "agent", response)
            await self._manager.append_transcript(self._session_id, "agent", response)
            await self._manager.send_browser_message(
                self._session_id,
                {"type": "transcript", "role": "agent", "text": response},
            )

            # Arm the speaking-done event BEFORE we push frames so the
            # BotSpeakingWatchdog can flip it as soon as Pipecat emits
            # BotStoppedSpeakingFrame. We then wait on it (with a generous
            # safety timeout) — only after TTS has actually drained do we
            # release the IDLE lock and start accepting new transcriptions.
            #
            # Pipecat's TTS service uses a sentence aggregator that buffers
            # incomplete trailing sentences. The buffer is only flushed when
            # an LLMFullResponseEndFrame arrives, and a fresh TTS context is
            # created on LLMFullResponseStartFrame. Wrapping every response in
            # this pair guarantees:
            #   1. Each turn gets its own clean Cartesia context.
            #   2. The final sentence (no trailing whitespace+capital) gets
            #      flushed instead of leaking into the next turn.
            done_event = self._manager.arm_bot_speaking_done(self._session_id)
            await self.push_frame(LLMFullResponseStartFrame())
            await self.push_frame(TextFrame(response))
            await self.push_frame(LLMFullResponseEndFrame())
            try:
                await asyncio.wait_for(done_event.wait(), timeout=45.0)
            except asyncio.TimeoutError:
                logger.warning(
                    "[%s] Timed out waiting for TTS to finish; releasing anyway",
                    self._session_id,
                )
                await self._manager.send_browser_message(
                    self._session_id,
                    {"type": "agent_speaking", "speaking": False},
                )

            if end_after:
                asyncio.create_task(
                    self._manager.end_session(self._session_id, "agent_finished", force_cancel=False)
                )
        except asyncio.CancelledError:
            logger.info("[%s] _respond task cancelled", self._session_id)
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
            endpointing=2500,
            utterance_end_ms=3000,
            smart_format=True,
            interim_results=True,
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
                confidence=0.55,
                start_secs=0.4,
                stop_secs=1.8,
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
            BotSpeakingWatchdog(session.session_id, manager),
            transport.output(),
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=False,
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
        sess = await manager.get_session(session.session_id)
        if sess and sess.status not in ("completed", "expired"):
            await manager.update_status(session.session_id, "completed")
            await manager.send_callback(session.session_id)
        logger.info("Pipeline finished for session %s", session.session_id)
