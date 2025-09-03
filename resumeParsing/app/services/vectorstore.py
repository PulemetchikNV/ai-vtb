from typing import List, Dict, Any, Optional

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from app.config import CHROMA_DIR, CHROMA_COLLECTION, EMBED_MODEL


_client: Optional[chromadb.Client] = None
_collection = None


def get_client() -> chromadb.Client:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client


def get_collection():
    global _collection
    if _collection is None:
        client = get_client()
        embedding_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL, device="cuda")
        # create if not exists
        try:
            _collection = client.get_collection(CHROMA_COLLECTION)
        except Exception:
            _collection = client.create_collection(
                name=CHROMA_COLLECTION,
                embedding_function=embedding_fn,
                metadata={"hnsw:space": "cosine"},
            )
        # Ensure embedding function is attached (for collections created earlier without it)
        if getattr(_collection, "_embedding_function", None) is None:
            _collection._embedding_function = embedding_fn
    return _collection


def add_documents(documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]):
    collection = get_collection()
    collection.add(documents=documents, metadatas=metadatas, ids=ids)


def similarity_search(query: str, n_results: int = 5, where: Optional[Dict[str, Any]] = None):
    collection = get_collection()
    return collection.query(query_texts=[query], n_results=n_results, where=where)


def delete_all():
    client = get_client()
    # recreate collection
    global _collection
    try:
        client.delete_collection(CHROMA_COLLECTION)
    except Exception:
        pass
    _collection = None
    return get_collection()

