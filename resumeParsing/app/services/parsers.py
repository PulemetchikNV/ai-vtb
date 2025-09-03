from typing import Optional

from pypdf import PdfReader
from docx import Document


def read_txt_bytes(data: bytes, encoding: str = "utf-8") -> str:
    try:
        return data.decode(encoding)
    except UnicodeDecodeError:
        # Fallback: попытка с cp1251 для ru-текстов
        return data.decode("cp1251", errors="ignore")


def extract_text_from_pdf_bytes(data: bytes) -> str:
    from io import BytesIO

    pdf_stream = BytesIO(data)
    reader = PdfReader(pdf_stream)
    texts = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            # Игнорируем проблемные страницы
            continue
    return "\n".join(texts)


def extract_text_from_docx_bytes(data: bytes) -> str:
    from io import BytesIO

    doc_stream = BytesIO(data)
    doc = Document(doc_stream)
    paragraphs = [p.text for p in doc.paragraphs if p.text]
    return "\n".join(paragraphs)


def extract_text(filename: str, data: bytes) -> Optional[str]:
    name = filename.lower()
    if name.endswith(".txt"):
        return read_txt_bytes(data)
    if name.endswith(".pdf"):
        return extract_text_from_pdf_bytes(data)
    if name.endswith(".docx"):
        return extract_text_from_docx_bytes(data)
    return None

