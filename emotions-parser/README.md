## Emotions Parser (анализ эмоций из аудио WAV)

Flask-приложение, которое принимает аудио `.wav`, распознает речь (ru-RU), анализирует тональность текста через HuggingFace `nlptown/bert-base-multilingual-uncased-sentiment` и выделяет паузы с использованием `webrtcvad`.

### Возможности
- Веб-форма загрузки файла и страница результата
- Авто-удаление временного файла после анализа
- Кэширование моделей HuggingFace в локальной папке

### Требования
- Python 3.11+
- ffmpeg (для `pydub`)

### Установка локально
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export FLASK_ENV=production
python app.py
```

Откройте `http://localhost:5000`.

### Docker
```bash
docker build -f emotions-parser/Dockerfile -t emotions-parser:latest emotions-parser
docker run --rm -p 5000:5000 emotions-parser:latest
```

### Интеграция с docker-compose
Сервис будет доступен как `emotions` (прод) и `emotions-dev` (dev) на порту 5000.

### Переменные окружения (опц.)
- `HF_HOME`, `TRANSFORMERS_CACHE`, `HUGGINGFACE_HUB_CACHE` — директории кэша моделей
- `HUGGING_FACE_HUB_TOKEN` — токен HuggingFace (если требуется для частных моделей)

