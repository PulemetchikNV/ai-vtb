## TTS сервис (Text-to-Speech)

Сервис синтеза речи (ru) на базе Google Gemini (модель `gemini-2.5-pro-preview-tts`). Предоставляет HTTP API (FastAPI) и CLI-скрипт для локальной генерации аудио.

### Возможности
- Генерация речи по тексту с выбором голоса
- HTTP API: `POST /synthesize` возвращает `audio/wav`
- Здоровье сервиса: `GET /health`
- CLI-скрипт (`python main.py`) для быстрой проверки локально

### Требования
- Python 3.11+
- Аккаунт и ключ API: переменная окружения `GEMINI_API_KEY`
- (Опционально) `ffmpeg`, если включено локальное воспроизведение через pydub

### Установка локально
```bash
python -m venv myvenv
source myvenv/bin/activate
pip install -r requirements.txt
```

### Запуск HTTP API локально
```bash
export GEMINI_API_KEY=...  # Ваш ключ
uvicorn app:app --host 0.0.0.0 --port 8081
```

Проверка:
```bash
curl -s -X POST http://localhost:8081/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"text":"Привет!","voice_name":"Zephyr","temperature":1.0}' \
  --output tts.wav
```

### Запуск CLI (пример)
```bash
export GEMINI_API_KEY=...
export TTS_TEXT="Привет!"
python main.py
```

Поддерживаемые переменные окружения для CLI:
- `TTS_TEXT` — текст для озвучки (по умолчанию: «привет»)
- `TTS_VOICE` — имя голоса, по умолчанию `Zephyr`
- `TTS_TEMPERATURE` — температура, по умолчанию `1.0`
- `OUTPUT_DIR` — каталог для сохранения файлов (по умолчанию текущий)
- `PLAY_AUDIO` — `1` чтобы воспроизводить аудио локально (требует ffmpeg)

### Docker
Сборка образа:
```bash
docker build -f tts/Dockerfile -t tts:latest .
```

Запуск контейнера:
```bash
docker run --rm -e GEMINI_API_KEY=... -p 8081:8081 tts:latest
```

### Интеграция с docker-compose
Сервис добавлен в корневые файлы:
- `docker-compose.yml`: сервис `tts`
- `docker-compose.dev.yml`: сервис `tts-dev` (с авто‑перезагрузкой)

Примеры запуска:
```bash
# Продакшн compose
docker compose up -d tts

# Dev compose
docker compose -f docker-compose.dev.yml up -d tts-dev
```

### API
- `GET /health` → `{ "status": "ok" }`
- `POST /synthesize`
  - Body:
    ```json
    {"text":"Привет!","voice_name":"Zephyr","temperature":1.0}
    ```
  - Response: поток аудио `audio/wav`

### Примечания безопасности
- Не храните ключи в коде. Используйте переменные окружения `GEMINI_API_KEY`.


