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
        embedding_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
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


def get_by_where(where: Dict[str, Any], limit: Optional[int] = None, include: Optional[List[str]] = None):
    collection = get_collection()
    kwargs: Dict[str, Any] = {"where": where}
    if limit is not None:
        kwargs["limit"] = limit
    if include is not None:
        kwargs["include"] = include
    return collection.get(**kwargs)


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


# Named collections (for per-chat facts)
def get_named_collection(name: str):
    client = get_client()
    embedding_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
    try:
        col = client.get_collection(name)
    except Exception:
        col = client.create_collection(
            name=name,
            embedding_function=embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
    if getattr(col, "_embedding_function", None) is None:
        col._embedding_function = embedding_fn  # type: ignore
    return col


def ensure_collection(name: str):
    get_named_collection(name)
    return {"ok": True, "name": name}


def add_documents_to(collection_name: str, documents: List[str], metadatas: List[Dict[str, Any]], ids: Optional[List[str]] = None):
    col = get_named_collection(collection_name)
    if ids is None:
        # basic ids
        ids = [f"{collection_name}_{i}" for i in range(len(documents))]
    col.add(documents=documents, metadatas=metadatas, ids=ids)
    return {"ok": True, "count": len(documents)}


def query_named_collection(name: str, query_text: str, n_results: int = 3, where: Optional[Dict[str, Any]] = None):
    col = get_named_collection(name)
    return col.query(query_texts=[query_text], n_results=n_results, where=where)


def update_document_metadata(collection_name: str, ids: List[str], metadatas: List[Dict[str, Any]]):
    col = get_named_collection(collection_name)
    col.update(ids=ids, metadatas=metadatas)
    return {"ok": True, "updated": len(ids)}

