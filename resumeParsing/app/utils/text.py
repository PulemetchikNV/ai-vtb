from typing import List


def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    if not text:
        return []
    if chunk_size <= 0:
        return [text]
    chunks = []
    start = 0
    text_length = len(text)
    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk = text[start:end]
        # Убираем пустые и слишком короткие чанки
        if chunk.strip():
            chunks.append(chunk)
        if end == text_length:
            break
        start = end - overlap if overlap > 0 else end
        if start < 0:
            start = 0
    return chunks

