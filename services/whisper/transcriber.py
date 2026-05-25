"""
Whisper transcription wrapper using faster-whisper.
faster-whisper is significantly faster than openai-whisper on CPU and GPU.
"""

import logging
from typing import Any

logger = logging.getLogger("cortex.whisper.core")


class WhisperTranscriber:
    def __init__(
        self,
        model_size: str = "base",
        device: str = "auto",
        compute_type: str = "auto",
    ) -> None:
        from faster_whisper import WhisperModel

        self.model_size = model_size

        # Auto-select device and compute type
        if device == "auto":
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                device = "cpu"

        if compute_type == "auto":
            compute_type = "float16" if device == "cuda" else "int8"

        logger.info(f"Loading faster-whisper {model_size} on {device} ({compute_type})")

        self.model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            download_root=str(
                __import__("pathlib").Path.home() / ".cortex" / "whisper-models"
            ),
        )

        logger.info("faster-whisper loaded successfully")

    def transcribe(
        self,
        audio_path: str,
        language: str | None = None,
        task: str = "transcribe",
        beam_size: int = 5,
        best_of: int = 5,
        temperature: float = 0.0,
        vad_filter: bool = True,
    ) -> dict[str, Any]:
        """
        Transcribe an audio file.

        Returns dict with:
          - text: full transcript
          - language: detected/specified language code
          - duration: audio duration in seconds
          - segments: list of timed segments
        """
        segments, info = self.model.transcribe(
            audio_path,
            language=language,
            task=task,
            beam_size=beam_size,
            best_of=best_of,
            temperature=temperature,
            vad_filter=vad_filter,
            vad_parameters={
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 200,
            },
            word_timestamps=False,
        )

        segment_list = []
        full_text_parts = []

        for seg in segments:
            text = seg.text.strip()
            full_text_parts.append(text)
            segment_list.append(
                {
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": text,
                }
            )

        full_text = " ".join(full_text_parts).strip()

        logger.info(
            f"Transcribed {info.duration:.1f}s of audio "
            f"(lang={info.language}, prob={info.language_probability:.2f})"
        )

        return {
            "text": full_text,
            "language": info.language,
            "duration": round(info.duration, 2),
            "segments": segment_list,
        }
