import librosa
from transformers import pipeline
from whisper_lid.whisper_lid import detect_language_in_speech
from optimum.onnxruntime import ORTModelForSpeechSeq2Seq
import os
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

# --- Model Loading ---
# Use the original model ID. Optimum will handle the download and conversion to ONNX.
model_id = "bond005/whisper-podlodka-turbo"
target_sampling_rate = 16_000  # Hz

print("Loading and converting model to ONNX...")
# The `export=True` flag tells Optimum to download the PyTorch model and convert it to ONNX.
# The converted model will be cached locally for future runs.
model = ORTModelForSpeechSeq2Seq.from_pretrained(model_id, export=True)
print("Model loaded and converted to ONNX.")

asr = pipeline(
    task="automatic-speech-recognition",
    model=model,
    tokenizer=model_id,
    feature_extractor=model_id,
    device_map='auto',
    torch_dtype='auto'
)

# --- FastAPI Application ---
app = FastAPI()

# Mount the static directory to serve frontend files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

@app.post("/transcribe/")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts an audio file, transcribes it, and returns the transcription.
    """
    if not file.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an audio file.")

    try:
        # Save the uploaded file to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_audio_file:
            content = await file.read()
            temp_audio_file.write(content)
            temp_audio_file_path = temp_audio_file.name

        # Load the audio file with librosa
        sound_audio = librosa.load(temp_audio_file_path, sr=target_sampling_rate, mono=True)[0]

        # Detect language
        detected_languages = detect_language_in_speech(
            sound_audio,
            asr.feature_extractor,
            asr.tokenizer,
            asr.model
        )
        
        if not detected_languages:
            raise HTTPException(status_code=500, detail="Could not detect language in the audio file.")

        primary_language = detected_languages[0][0]

        # Perform transcription
        recognition_result = asr(
            sound_audio,
            generate_kwargs={'task': 'transcribe', 'language': primary_language},
            return_timestamps=False
        )

        return {"transcription": recognition_result['text']}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during transcription: {str(e)}")
    finally:
        # Clean up the temporary file
        if 'temp_audio_file_path' in locals() and os.path.exists(temp_audio_file_path):
            os.remove(temp_audio_file_path)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5544)
