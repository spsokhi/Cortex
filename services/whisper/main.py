"""
Cortex Whisper Transcription Microservice
Offline speech-to-text using faster-whisper (CTranslate2 backend).
Serves on localhost:8002.
"""

import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from transcriber import WhisperTranscriber

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cortex.whisper")

transcriber: WhisperTranscriber | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global transcriber
    model_size = os.getenv("WHISPER_MODEL", "base")
    device = os.getenv("WHISPER_DEVICE", "auto")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "auto")

    logger.info(f"Loading Whisper model: {model_size} on {device}")
    transcriber = WhisperTranscriber(
        model_size=model_size,
        device=device,
        compute_type=compute_type,
    )
    logger.info("Whisper service ready")
    yield
    logger.info("Whisper service shutting down")


app = FastAPI(
    title="Cortex Whisper Service",
    description="Local speech-to-text — no cloud, no internet required",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class TranscriptionResponse(BaseModel):
    text: str
    language: str
    duration: float
    segments: list[dict] = []


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "model": transcriber.model_size if transcriber else "not loaded",
    }


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    audio: UploadFile = File(...),
    language: str | None = Form(default=None),
    task: str = Form(default="transcribe"),  # "transcribe" or "translate"
) -> TranscriptionResponse:
    if transcriber is None:
        raise HTTPException(status_code=503, detail="Transcription service not ready")

    if audio.content_type and not audio.content_type.startswith("audio/"):
        # Also accept video files (extract audio)
        if not audio.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="File must be audio or video")

    # Write to temp file (faster-whisper needs a file path)
    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = transcriber.transcribe(
            audio_path=tmp_path,
            language=language,
            task=task,
        )
        return TranscriptionResponse(**result)
    except Exception as e:
        logger.exception("Transcription error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        os.unlink(tmp_path)


@app.post("/transcribe-bytes", response_model=TranscriptionResponse)
async def transcribe_bytes(
    audio_base64: str,
    language: str | None = None,
    task: str = "transcribe",
    format: str = "webm",
) -> TranscriptionResponse:
    """Transcribe audio from base64-encoded bytes (useful for Tauri IPC)."""
    import base64

    if transcriber is None:
        raise HTTPException(status_code=503, detail="Transcription service not ready")

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid base64") from e

    with tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = transcriber.transcribe(
            audio_path=tmp_path,
            language=language,
            task=task,
        )
        return TranscriptionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        os.unlink(tmp_path)


@app.get("/models")
async def list_models() -> dict:
    """List available Whisper model sizes."""
    return {
        "models": [
            {"name": "tiny", "size_mb": 75, "relative_speed": "10x"},
            {"name": "base", "size_mb": 142, "relative_speed": "7x"},
            {"name": "small", "size_mb": 466, "relative_speed": "4x"},
            {"name": "medium", "size_mb": 1500, "relative_speed": "2x"},
            {"name": "large-v3", "size_mb": 3100, "relative_speed": "1x"},
        ]
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8002"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
