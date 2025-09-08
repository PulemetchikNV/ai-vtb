import os
import mimetypes
import struct
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.genai import errors
from speechkit import model_repository, configure_credentials, creds


app = FastAPI(title="VTB TTS Service", version="1.0.0")

# CORS (dev): разрешаем запросы с фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynthesizeRequest(BaseModel):
    text: str
    voice_name: str = "Zephyr"
    temperature: float = 1.0


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/synthesize")
def synthesize(payload: SynthesizeRequest) -> Response:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set")

    client = genai.Client(api_key=api_key)

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=payload.text)],
        )
    ]

    generate_content_config = types.GenerateContentConfig(
        temperature=payload.temperature,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=payload.voice_name)
            )
        ),
    )

    collected_bytes = bytearray()
    detected_mime: Optional[str] = None

    try:
        for chunk in client.models.generate_content_stream(
            model="gemini-2.5-flash-preview-tts",
            contents=contents,
            config=generate_content_config,
        ):
            print('=== CHUNK ===', chunk)
            if (
                not chunk.candidates
                or not chunk.candidates[0].content
                or not chunk.candidates[0].content.parts
            ):
                continue

            part = chunk.candidates[0].content.parts[0]
            if getattr(part, "inline_data", None) and part.inline_data.data:
                if detected_mime is None:
                    detected_mime = part.inline_data.mime_type
                collected_bytes.extend(part.inline_data.data)
    except errors.ClientError as e:
        status = getattr(e, "status_code", None)
        message = str(e)
        if status == 429 or "RESOURCE_EXHAUSTED" in message or "quota" in message.lower():
            # Quota/rate limit exceeded — return 429 with Retry-After
            raise HTTPException(status_code=429, detail="Gemini quota exceeded. Try later.", headers={"Retry-After": "16"})
        elif status == 401:
            raise HTTPException(status_code=502, detail="GEMINI_API_KEY invalid or unauthorized")
        else:
            raise HTTPException(status_code=502, detail=f"Gemini client error: {message}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {e}")

    if not collected_bytes:
        raise HTTPException(status_code=502, detail="No audio data returned by model")

    # Normalize to WAV if needed
    audio_bytes = bytes(collected_bytes)
    if not detected_mime:
        detected_mime = "audio/wav"

    if mimetypes.guess_extension(detected_mime) != ".wav":
        audio_bytes = convert_to_wav(audio_bytes, detected_mime)
        detected_mime = "audio/wav"

    return Response(content=audio_bytes, media_type=detected_mime)


class YaSynthesizeRequest(BaseModel):
    text: str
    voice: str | None = 'jane'
    role: str | None = 'good'


@app.post("/synthesize-ya")
def synthesize_ya(payload: YaSynthesizeRequest) -> Response:
    api_key = os.getenv("YANDEX_API_KEY")
    if not api_key:
        # Fallback to IAM token for backward compatibility
        iam_token = os.getenv("YANDEX_IAM_TOKEN") or os.getenv("IAM_TOKEN")
        if not iam_token:
            raise HTTPException(status_code=500, detail="YANDEX_API_KEY or YANDEX_IAM_TOKEN is not set")
        
        try:
            # Configure SpeechKit SDK with IAM token
            configure_credentials(
                yandex_credentials=creds.YandexCredentials(
                    iam_token=iam_token
                )
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"SpeechKit IAM token configuration error: {e}")
    else:
        try:
            # Configure SpeechKit SDK with API key
            configure_credentials(
                yandex_credentials=creds.YandexCredentials(
                    api_key=api_key
                )
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"SpeechKit API key configuration error: {e}")

    try:
        model = model_repository.synthesis_model()
        if payload.voice:
            model.voice = payload.voice
        if payload.role:
            model.role = payload.role

        result = model.synthesize(payload.text, raw_format=False)
        # Export to bytes in WAV
        wav_bytes = result.export_bytes('wav') if hasattr(result, 'export_bytes') else None
        if wav_bytes is None:
            # Fallback: export to temp file then read
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as tmp:
                result.export(tmp.name, 'wav')
                tmp.seek(0)
                wav_bytes = tmp.read()

        return Response(content=wav_bytes, media_type='audio/wav')
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SpeechKit error: {e}")

def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header + audio_data


def parse_audio_mime_type(mime_type: str) -> dict[str, int | None]:
    bits_per_sample = 16
    rate = 24000
    parts = mime_type.split(";")
    for param in parts:
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate_str = param.split("=", 1)[1]
                rate = int(rate_str)
            except (ValueError, IndexError):
                pass
        elif param.startswith("audio/L"):
            try:
                bits_per_sample = int(param.split("L", 1)[1])
            except (ValueError, IndexError):
                pass
    return {"bits_per_sample": bits_per_sample, "rate": rate}


