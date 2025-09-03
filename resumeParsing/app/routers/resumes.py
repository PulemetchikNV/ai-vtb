import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Form
from fastapi.responses import JSONResponse

from app.config import UPLOADS_DIR, CHUNK_SIZE, CHUNK_OVERLAP
from app.services.parsers import extract_text
from app.utils.text import chunk_text
from app.services.vectorstore import add_documents, similarity_search, delete_all
from app.utils.names import normalize_name, generate_candidate_id


router = APIRouter()


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...), name: str = Form("") ):
    filename = file.filename or "resume"
    raw = await file.read()

    text = extract_text(filename, raw)
    if text is None or not text.strip():
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат или пустой файл")

    # логируем оригинал
    uid = uuid.uuid4().hex
    target_path = Path(UPLOADS_DIR) / f"{uid}_{Path(filename).name}"
    with open(target_path, "wb") as f:
        f.write(raw)

    # чанкинг и сохранение в Chroma
    chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
    ids = [f"{uid}_{i}" for i in range(len(chunks))]
    name_norm = normalize_name(name)
    candidate_id = generate_candidate_id(name_norm) if name_norm else ""
    metadatas = [{
        "source": str(target_path),
        "filename": filename,
        "uid": uid,
        "chunk_index": i,
        "name": name.strip() if name else "",
        "name_norm": name_norm,
        "candidate_id": candidate_id,
    } for i in range(len(chunks))]

    if not chunks:
        raise HTTPException(status_code=400, detail="Не удалось извлечь текст из файла")

    add_documents(chunks, metadatas, ids)

    return JSONResponse({
        "uid": uid,
        "filename": filename,
        "chunks": len(chunks),
        "name": name.strip() if name else "",
        "name_norm": name_norm,
        "candidate_id": candidate_id,
    })


@router.get("/search")
async def search(query: str = Query(..., min_length=1), n: int = Query(5, ge=1, le=20), name: str = Query(""), candidate_id: str = Query("") ):
    where = None
    if candidate_id:
        where = {"candidate_id": candidate_id}
    elif name:
        where = {"name_norm": normalize_name(name)}
    results = similarity_search(query, n_results=n, where=where)
    return JSONResponse(results)


@router.get("/find-by-name")
async def find_by_name(name: str = Query(..., min_length=1), n: int = Query(5, ge=1, le=50)):
    # «немой» запрос: используем имя как query, а также фильтруем по нормализованному имени
    name_norm = normalize_name(name)
    results = similarity_search(name_norm, n_results=n, where={"name_norm": name_norm})
    return JSONResponse(results)


@router.post("/reset")
async def reset_collection():
    delete_all()
    return JSONResponse({"status": "ok", "message": "collection reset"})

