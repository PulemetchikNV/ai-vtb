from typing import List


def _split_by_headers(text: str, headers: List[str]) -> List[str]:
    if not text:
        return []
    # Нормализуем переносы
    t = text.replace("\r\n", "\n")
    # Последовательно пытаемся делить по приоритетным заголовкам
    for header in headers:
        if header in t:
            parts = t.split(header)
            # Вернём заголовок к каждой части (кроме первой пустой до первого вхождения)
            restored: List[str] = []
            if parts and parts[0].strip():
                restored.append(parts[0])
            for part in parts[1:]:
                restored.append((header + part).strip())
            return [p for p in restored if p.strip()]
    return [t]


def _split_by_paragraphs(text: str) -> List[str]:
    # Делим по двойному переносу как по абзацам
    blocks = [b.strip() for b in text.replace("\r\n", "\n").split("\n\n")]
    return [b for b in blocks if b]


def _sliding_window_char_chunks(text: str, chunk_size: int, overlap: int) -> List[str]:
    chunks: List[str] = []
    start = 0
    n = len(text)
    if chunk_size <= 0:
        return [text]
    while start < n:
        end = min(start + chunk_size, n)
        piece = text[start:end]
        if piece.strip():
            chunks.append(piece)
        if end == n:
            break
        start = max(0, end - overlap)
    return chunks


def chunk_structured_document(
    text: str,
    chunk_size: int,
    overlap: int,
    priority_headers: List[str] | None = None,
) -> List[str]:
    """
    Стратегия для резюме/вакансий:
    1) Пытаемся делить по приоритетным заголовкам
    2) Внутри больших секций делим по абзацам
    3) Если кусок всё ещё длинный — скользящее окно по символам
    """
    if not text:
        return []

    headers = priority_headers or [
        "\nОпыт работы",
        "\nОбразование",
        "\nНавыки",
        "\nДополнительная информация",
    ]

    sections = _split_by_headers(text, headers)
    final_chunks: List[str] = []
    for sec in sections:
        if len(sec) <= chunk_size:
            final_chunks.append(sec)
            continue
        # Делим по абзацам
        paragraphs = _split_by_paragraphs(sec)
        current = ""
        for para in paragraphs:
            # если добавление параграфа превысит порог — закрываем текущий чанк
            if current and len(current) + 2 + len(para) > chunk_size:
                # если чанк всё ещё слишком длинный (редко) — дорезаем окном
                if len(current) > chunk_size:
                    final_chunks.extend(_sliding_window_char_chunks(current, chunk_size, overlap))
                else:
                    final_chunks.append(current)
                current = para
            else:
                current = para if not current else current + "\n\n" + para
        if current:
            if len(current) > chunk_size:
                final_chunks.extend(_sliding_window_char_chunks(current, chunk_size, overlap))
            else:
                final_chunks.append(current)

    # Последняя защита от слишком крупных кусков
    really_final: List[str] = []
    for c in final_chunks:
        if len(c) > chunk_size:
            really_final.extend(_sliding_window_char_chunks(c, chunk_size, overlap))
        else:
            really_final.append(c)

    print(f"really_final: {really_final}")
    return really_final


def chunk_dialogue(
    text: str,
    utterances_per_chunk: int = 4,
    utterance_overlap: int = 2,
) -> List[str]:
    if not text:
        return []
    lines = [ln.strip() for ln in text.replace("\r\n", "\n").split("\n") if ln.strip()]
    if not lines:
        return []
    if len(lines) <= utterances_per_chunk:
        return ["\n".join(lines)]
    chunks: List[str] = []
    step = max(1, utterances_per_chunk - utterance_overlap)
    for start in range(0, len(lines), step):
        window = lines[start:start + utterances_per_chunk]
        if not window:
            break
        chunks.append("\n".join(window))
        if start + utterances_per_chunk >= len(lines):
            break
    return chunks


