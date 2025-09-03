# HR Analyzer Service (Сервис 1: загрузка резюме в ChromaDB)

- FastAPI API для загрузки резюме (pdf/docx/txt), извлечения текста, чанкинга и сохранения в ChromaDB с эмбеддингами FastEmbed.

## Запуск

1) Создать venv и установить зависимости:
```bash
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Запустить API:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3) Эндпоинты:
- POST `/api/resumes/upload` — загрузка файла резюме (pdf/docx/txt), сохранение в ChromaDB
- GET `/api/resumes/search?query=...&n=5` — проверочный поиск по базе

## Переменные окружения (опционально)
- `UPLOADS_DIR` — путь для сохранения исходных файлов (по умолчанию `data/uploads`)
- `CHROMA_DIR` — путь для ChromaDB (по умолчанию `data/chroma`)
- `CHROMA_COLLECTION` — имя коллекции (по умолчанию `resumes`)
- `EMBED_MODEL` — модель для FastEmbed (по умолчанию `BAAI/bge-m3`)
- `CHUNK_SIZE` — размер чанка символов (по умолчанию 800)
- `CHUNK_OVERLAP` — перекрытие чанков (по умолчанию 120)

## Заметки
- Используется `FastEmbedEmbeddingFunction` (CPU-friendly), подходит для локального хакатон-запуска.
- Для PDF используются `pypdf`, для DOCX — `python-docx`.
