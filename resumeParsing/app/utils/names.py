import re
import uuid


_SPACE_RE = re.compile(r"\s+")
_NON_ALNUM_RE = re.compile(r"[^0-9a-zA-Zа-яА-ЯёЁ\s]+")


def normalize_name(name: str) -> str:
    if not name:
        return ""
    cleaned = _NON_ALNUM_RE.sub(" ", name.strip().lower())
    collapsed = _SPACE_RE.sub(" ", cleaned)
    return collapsed.strip()


def generate_candidate_id(name_norm: str) -> str:
    if not name_norm:
        return ""
    # Детеминированный UUID5 на основе нормализованного имени
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"candidate:{name_norm}"))


