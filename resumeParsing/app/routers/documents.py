from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.extractors import extract_structured_data
from app.utils.text import chunk_text
from app.utils.chunking import chunk_structured_document, chunk_dialogue
from app.services.vectorstore import add_documents, get_collection, delete_all, get_by_where


router = APIRouter()


class DocumentIn(BaseModel):
    source_id: str = Field(..., min_length=1)
    source_type: str = Field(..., pattern=r"^(resume|dialogue|vacancy)$")
    document_name: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class QueryFilter(BaseModel):
    field: str
    operator: str = Field(..., pattern=r"^\$(eq|gt|gte|lt|lte|ne|in|nin)$")
    value: Any


class QueryIn(BaseModel):
    query_text: Optional[str] = None
    filters: List[QueryFilter] = []
    top_k: int = 5


def build_where(filters: List[QueryFilter]) -> Optional[Dict[str, Any]]:
    if not filters:
        return None
    clauses: List[Dict[str, Any]] = []
    for f in filters:
        field = f.field
        op = f.operator
        value = f.value
        clauses.append({field: {op: value}})
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


@router.post("/documents", status_code=201)
async def add_document(doc: DocumentIn):
    text = doc.content
    structured = extract_structured_data(text, doc.source_type)
    # Chroma метаданные поддерживают только скаляры; разворачиваем во flat-вид
    flat_structured = {f"structured_data.{k}": v for k, v in structured.items()}

    # Выбираем стратегию чанкинга по типу документа
    if doc.source_type in ("resume", "vacancy"):
        chunks = chunk_structured_document(text, 800, 120)
    elif doc.source_type == "dialogue":
        chunks = chunk_dialogue(text, utterances_per_chunk=4, utterance_overlap=2)
    else:
        chunks = chunk_text(text, 800, 120)
    if not chunks:
        raise HTTPException(status_code=400, detail="Пустой документ")

    # Кеширование: если уже есть документы с таким source_id и source_type — возвращаем их, не добавляя повторно
    existing = get_by_where({
        "source_id": {"$eq": doc.source_id},
        "source_type": {"$eq": doc.source_type},
    }, include=["ids", "metadatas"], limit=1)
    if existing and existing.get("ids"):
        return {"source_id": doc.source_id, "chunks": len(existing.get("ids", [])), "structured_data": structured, "cached": True}

    ids = [f"{doc.source_id}_{i}_{uuid4().hex[:8]}" for i in range(len(chunks))]
    metadatas = [{
        "source_id": doc.source_id,
        "source_type": doc.source_type,
        "document_name": doc.document_name,
        "chunk_index": i,
        **flat_structured,
    } for i in range(len(chunks))]

    print(f'ADDED {len(chunks)} chunks for {doc.source_id} {doc.source_type} {doc.document_name}')
    print(f'METADATAS: {metadatas}')

    add_documents(chunks, metadatas, ids)
    return {"source_id": doc.source_id, "chunks": len(chunks), "structured_data": structured, "cached": False}


@router.post("/query")
async def query_documents(q: QueryIn):
    collection = get_collection()
    where = build_where(q.filters)

    # Поддержка: только фильтры (без query_text) — вернём top_k по фильтру
    if not q.query_text:
        res = collection.get(where=where, limit=q.top_k, include=["metadatas", "documents"])
        return res

    res = collection.query(query_texts=[q.query_text], where=where, n_results=q.top_k)
    return res


@router.post("/reset")
async def reset_all():
    delete_all()
    return {"status": "ok", "message": "collection reset"}


