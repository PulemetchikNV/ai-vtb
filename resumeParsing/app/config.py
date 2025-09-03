import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

# Директория для исходных загрузок (логирование)
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BASE_DIR / "data" / "uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Директория для персистентного хранилища Chroma
CHROMA_DIR = Path(os.getenv("CHROMA_DIR", BASE_DIR / "data" / "chroma"))
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# Имя коллекции
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "resumes")

# Модель эмбеддингов для Chroma SentenceTransformerEmbeddingFunction
EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

# Чанкинг
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 800))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 120))

