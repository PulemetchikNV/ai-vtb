FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UVICORN_WORKERS=1

WORKDIR /app

# Системные зависимости для onnxruntime/lxml и шрифты
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libxml2-dev libxslt1-dev \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY resumeParsing/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY resumeParsing/app /app/app

# Папки данных для персистентности
RUN mkdir -p /app/data/uploads /app/data/chroma

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


