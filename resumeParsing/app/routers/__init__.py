from fastapi import APIRouter
from app.services.vectorstore import ensure_collection, add_documents_to, query_named_collection, update_document_metadata

router = APIRouter()

@router.post('/facts/collections/{chat_id}')
def create_facts_collection(chat_id: str):
    name = f"facts__{chat_id}"
    return ensure_collection(name)

@router.post('/facts/collections/{chat_id}/documents')
def add_fact(chat_id: str, payload: dict):
    name = f"facts__{chat_id}"
    text = payload.get('text') or ''
    meta = payload.get('meta') or {}
    doc_id = payload.get('id')
    if not text:
        return {"ok": False, "error": "text is required"}
    return add_documents_to(name, [text], [meta], ids=[doc_id] if doc_id else None)


@router.post('/facts/collections/{chat_id}/search')
def search_facts(chat_id: str, payload: dict):
    name = f"facts__{chat_id}"
    query = payload.get('query') or ''
    top_k = int(payload.get('top_k') or 3)
    if not query:
        return {"ok": False, "error": "query is required"}
    where = payload.get('where')
    res = query_named_collection(name, query_text=query, n_results=top_k, where=where)
    return res


@router.post('/facts/collections/{chat_id}/update')
def update_facts_metadata(chat_id: str, payload: dict):
    name = f"facts__{chat_id}"
    ids = payload.get('ids') or []
    metas = payload.get('metadatas') or []
    if not ids or not metas or len(ids) != len(metas):
        return {"ok": False, "error": "ids and metadatas must be same-length arrays"}
    return update_document_metadata(name, ids=ids, metadatas=metas)


