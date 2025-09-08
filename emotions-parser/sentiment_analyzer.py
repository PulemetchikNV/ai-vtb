import os
import sys
import webrtcvad
from pydub import AudioSegment
import collections

# Устанавливаем пути для кэша Hugging Face в локальную временную папку,
# чтобы избежать ошибок при работе с сетевыми дисками.
temp_dir = os.environ.get('TEMP', 'C:/temp')
cache_dir = os.path.join(temp_dir, 'hf_cache_golos')
os.makedirs(cache_dir, exist_ok=True)
os.environ['HF_HOME'] = cache_dir
os.environ['TRANSFORMERS_CACHE'] = cache_dir
os.environ['HUGGINGFACE_HUB_CACHE'] = cache_dir
token_path = os.path.join(cache_dir, 'token')
os.environ['HUGGINGFACE_HUB_TOKEN_PATH'] = token_path
os.environ['HUGGING_FACE_HUB_TOKEN'] = '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'

import speech_recognition as sr
from speechkit import model_repository, configure_credentials, creds
from transformers import pipeline

# --- Глобальные переменные ---
EMOTIONS = {0: "angry", 1: "sad", 2: "neutral", 3: "positive"}

print("Загрузка модели анализа тональности... (может занять несколько минут)")
sentiment_analyzer_pipeline = pipeline("text-classification", model="nlptown/bert-base-multilingual-uncased-sentiment")
print("Модель успешно загружена.")

# --- Функции ---

def analyze_pauses(audio_file_path, aggressiveness=1, frame_duration_ms=30, min_pause_duration_ms=300):
    """
    Анализирует аудиофайл на наличие пауз с помощью WebRTC VAD.
    """
    try:
        audio = AudioSegment.from_wav(audio_file_path)
    except Exception as e:
        return {"error": f"Не удалось прочитать WAV файл: {e}"}

    # VAD работает только с 8000, 16000, 32000, 48000 Hz
    if audio.frame_rate not in [8000, 16000, 32000, 48000]:
        return {"error": f"Неподдерживаемая частота дискретизации: {audio.frame_rate}"}
    
    vad = webrtcvad.Vad(aggressiveness)
    
    # Получаем сырые аудиоданные в виде байтов
    sample_rate = 16000
    raw_audio_data = audio.set_frame_rate(sample_rate).set_channels(1).set_sample_width(2).raw_data
    
    # VAD работает с кадрами по 10, 20 или 30 мс. Рассчитываем размер кадра в байтах.
    bytes_per_frame = int(sample_rate * (frame_duration_ms / 1000) * 2) # 2 байта на сэмпл (16-бит)
    
    frames_vad = collections.deque()
    for i in range(0, len(raw_audio_data), bytes_per_frame):
        frame = raw_audio_data[i:i+bytes_per_frame]
        if len(frame) < bytes_per_frame:
            break # Пропускаем последний, неполный кадр
        is_speech = vad.is_speech(frame, sample_rate)
        frames_vad.append(is_speech)

    pauses = []
    current_pause_start = None
    for i, is_speech in enumerate(frames_vad):
        if not is_speech:
            if current_pause_start is None:
                current_pause_start = i * frame_duration_ms
        elif current_pause_start is not None:
            pause_duration = (i * frame_duration_ms) - current_pause_start
            if pause_duration >= min_pause_duration_ms:
                pauses.append(pause_duration)
            current_pause_start = None
    
    if current_pause_start is not None:
        pause_duration = (len(frames_vad) * frame_duration_ms) - current_pause_start
        if pause_duration >= min_pause_duration_ms:
            pauses.append(pause_duration)

    return {
        "pause_count": len(pauses),
        "total_pause_duration_ms": sum(pauses),
        "pauses_ms": pauses
    }

def analyze_sentiment(audio_file_path, lang='ru'):
    """
    Анализирует тональность и паузы в аудиофайле.
    
    Args:
        audio_file_path: путь к WAV файлу
        lang: язык для распознавания ('ru', 'en', etc.)
    """
    if not os.path.exists(audio_file_path):
        return {"error": f"Файл не найден: {audio_file_path}"}
    
    if not audio_file_path.lower().endswith('.wav'):
        return {"error": "Скрипт принимает только файлы в формате .wav"}

    # 1. Анализ пауз
    pause_analysis = analyze_pauses(audio_file_path)

    # 2. Распознавание речи (Yandex SpeechKit)
    text = ''
    try:
        api_key = os.environ.get('YANDEX_API_KEY')
        if api_key:
            # Используем API key
            configure_credentials(yandex_credentials=creds.YandexCredentials(api_key=api_key))
        else:
            # Fallback to IAM token for backward compatibility
            iam_token = os.environ.get('YANDEX_IAM_TOKEN') or os.environ.get('IAM_TOKEN')
            if not iam_token:
                raise RuntimeError('YANDEX_API_KEY or YANDEX_IAM_TOKEN is not set')
            configure_credentials(yandex_credentials=creds.YandexCredentials(iam_token=iam_token))

        # Загружаем WAV, конвертируем в raw PCM 16k mono
        audio = AudioSegment.from_wav(audio_file_path).set_frame_rate(16000).set_channels(1).set_sample_width(2)
        raw_bytes = audio.raw_data

        asr = model_repository.recognition_model()
        
        # Задаём настройки распознавания
        asr.model = 'general'
        # Преобразуем код языка в формат Яндекса
        if lang == 'en':
            asr.language = 'en-US'
        elif lang == 'ru':
            asr.language = 'ru-RU'
        else:
            asr.language = 'ru-RU'  # по умолчанию русский
        
        # Попробуем разные варианты импорта и установки AudioProcessingType
        try:
            from speechkit import AudioProcessingType
            asr.audio_processing_type = AudioProcessingType.Full
        except ImportError:
            try:
                from speechkit.stt import AudioProcessingType
                asr.audio_processing_type = AudioProcessingType.Full
            except ImportError:
                try:
                    # Попробуем установить как строку
                    asr.audio_processing_type = 'Full'
                except Exception:
                    # Если ничего не работает, пропускаем этот параметр
                    print("Warning: AudioProcessingType not available, skipping audio_processing_type setting")
        
        # Если SDK поддерживает прямую подачу байтов:
        # asr.recognize(raw_audio=raw_bytes, format='lpcm', sampleRateHertz=16000)
        # Универсально через временный файл
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as tmp:
            audio.export(tmp.name, format='wav')
            result = asr.transcribe_file(tmp.name)
            # Попробуем извлечь текст в распространённых полях результата
            if isinstance(result, dict):
                text = result.get('result', '') or result.get('text', '') or ''
            else:
                text = str(result)
    except Exception as e:
        text = f"Ошибка распознавания речи (YA): {e}"

    # 3. Анализ тональности
    sentiment_result = {"label": "unknown", "score": 0.0}
    if "Ошибка" not in text:
        results = sentiment_analyzer_pipeline(text)
        sentiment_result = results[0]

    label = sentiment_result['label'].lower()
    if '5 stars' in label or '4 stars' in label:
        emotion_code = 3
    elif '1 star' in label:
        emotion_code = 0
    elif '2 stars' in label:
        emotion_code = 1
    else:
        emotion_code = 2

    return {
        "recognized_text": text,
        "sentiment_analysis": {
            "label": sentiment_result['label'],
            "score": sentiment_result['score'],
            "emotion": f"{emotion_code} (\"{EMOTIONS[emotion_code]}\")"
        },
        "pause_analysis": pause_analysis
    }

# Этот блок больше не нужен, так как скрипт будет использоваться как модуль.
# Запуск будет осуществляться через app.py
