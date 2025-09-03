import re
from typing import Dict


_EXPERIENCE_RE = re.compile(r"опыт\s+работы\s*[—-]?\s*(\d+)\s*(?:год|года|лет)?\s*(\d+)?\s*(?:месяц|месяца|месяцев)?", re.IGNORECASE)


def parse_experience_from_resume(text: str) -> Dict[str, int]:
    match = _EXPERIENCE_RE.search(text)
    if not match:
        return {}
    years = int(match.group(1)) if match.group(1) else 0
    months = int(match.group(2)) if match.group(2) else 0
    total_months = years * 12 + months
    if total_months <= 0:
        return {}
    return {"total_experience_months": total_months}


def extract_structured_data(text: str, source_type: str) -> Dict:
    data: Dict = {}
    if source_type == "resume":
        data.update(parse_experience_from_resume(text))
        # В будущем: возраст, навыки, грейд и т.д.
    # Для других типов (dialogue, vacancy) — доп. парсеры здесь
    return data


