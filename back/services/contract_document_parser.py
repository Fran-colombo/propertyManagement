import re
from datetime import date, datetime
from io import BytesIO
from typing import Optional

from pypdf import PdfReader


def extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def _parse_date_token(raw: str) -> Optional[date]:
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> Optional[float]:
    cleaned = raw.strip()
    cleaned = cleaned.replace("$", "").replace(" ", "")
    if re.match(r"^\d{1,3}(\.\d{3})+(,\d{1,2})?$", cleaned):
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        value = float(cleaned)
    except ValueError:
        return None
    if value <= 0 or value > 1_000_000_000:
        return None
    return round(value, 2)


def parse_contract_text(text: str) -> dict:
    suggestions = {}
    warnings = []
    normalized = text or ""
    lower = normalized.lower()

    if len(normalized.strip()) < 80:
        warnings.append(
            "El PDF no tiene texto suficiente. Si es un escaneo, completá los campos a mano."
        )
        return {
            "extracted_text_length": len(normalized.strip()),
            "warnings": warnings,
            "suggestions": suggestions,
        }

    date_matches = re.findall(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b", normalized)
    parsed_dates = []
    for token in date_matches:
        parsed = _parse_date_token(token)
        if parsed and parsed.year >= 1990:
            parsed_dates.append(parsed)
    unique_dates = []
    for d in parsed_dates:
        if d not in unique_dates:
            unique_dates.append(d)
    if len(unique_dates) >= 2:
        start, end = sorted(unique_dates[:8])[0], sorted(unique_dates[:8])[-1]
        if end > start:
            suggestions["start_date"] = start.isoformat()
            suggestions["end_date"] = end.isoformat()
    elif len(unique_dates) == 1:
        suggestions["start_date"] = unique_dates[0].isoformat()

    amount_candidates = []
    for match in re.finditer(
        r"(?:alquiler|canon|monto(?:\s+mensual)?|precio)[^\d$]{0,40}(\$?\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+)",
        lower,
        flags=re.IGNORECASE,
    ):
        value = _parse_amount(match.group(1))
        if value and value >= 1000:
            amount_candidates.append(value)
    if not amount_candidates:
        for match in re.finditer(r"\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{4,})", normalized):
            value = _parse_amount(match.group(1))
            if value and value >= 1000:
                amount_candidates.append(value)
    if amount_candidates:
        suggestions["base_rent"] = amount_candidates[0]

    if re.search(r"\bicl\b", lower):
        suggestions["index_type"] = "ICL"
    elif re.search(r"\bipc\b", lower):
        suggestions["index_type"] = "IPC"

    if re.search(r"semestral", lower):
        suggestions["frequency_adjustment"] = "SEMESTRAL"
    elif re.search(r"cuatrimestral", lower):
        suggestions["frequency_adjustment"] = "CUATRIMESTRAL"
    elif re.search(r"trimestral", lower):
        suggestions["frequency_adjustment"] = "TRIMESTRAL"

    if re.search(r"\bd[oó]lar", lower) or re.search(r"\busd\b", lower):
        suggestions["currency"] = "DOLARES"
    else:
        suggestions["currency"] = "PESOS"

    if re.search(r"\bepe\b", lower):
        suggestions["pays_epe"] = True
    if re.search(r"\btgi\b", lower):
        suggestions["pays_tgi"] = True
    if re.search(r"\bapi\b", lower):
        suggestions["pays_api"] = True
    if re.search(r"incendio", lower):
        suggestions["fire_insurance"] = True

    if not suggestions:
        warnings.append("No se reconocieron campos. Revisá y completá el formulario a mano.")

    return {
        "extracted_text_length": len(normalized.strip()),
        "warnings": warnings,
        "suggestions": suggestions,
    }


def parse_contract_pdf(data: bytes) -> dict:
    try:
        text = extract_pdf_text(data)
    except Exception:
        return {
            "extracted_text_length": 0,
            "warnings": ["No se pudo leer el PDF. Podés cargar el archivo igual y completar los campos a mano."],
            "suggestions": {},
        }
    return parse_contract_text(text)
