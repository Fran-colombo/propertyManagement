"""Consulta anónima de TGI en el SIAT de Rosario y armado del cargo mensual.

El cargo de un alquiler es el TGI del mes (capital, o capital + interés si ya está
vencido) más el período Pendiente de Pago más antiguo que todavía no se cargó
en otro mes de alquiler.
"""
from __future__ import annotations

import html
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date
from http.cookiejar import CookieJar
from typing import Iterable, Optional

SIAT_LOGIN_URL = (
    "https://siat.rosario.gob.ar/siat/seg/Login.do?method=anonimo"
    "&url=/gde/AdministrarLiqDeuda.do%3Fmethod%3DinicializarContr&id=14"
)
SIAT_ORIGIN = "https://siat.rosario.gob.ar"

ROW_RE = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
CELL_RE = re.compile(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
PERIOD_RE = re.compile(r"^(20\d{2})-(0[1-9]|1[0-2])$")
AMOUNT_RE = re.compile(
    r"(?<!\d)(\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2})(?!\d)"
)
ERROR_RE = re.compile(
    r'<ul[^>]*class="error"[^>]*>(.*?)</ul>', re.IGNORECASE | re.DOTALL
)


class SiatError(Exception):
    pass


@dataclass
class SiatInstallment:
    period: str
    kind: str
    capital: float
    interest: float
    status: str


def clean_tgi_account(value) -> Optional[str]:
    if value is None:
        return None
    cleaned = re.sub(r"[\s\-]", "", str(value))
    return cleaned or None


def clean_tgi_code(value) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def parse_tgi_detail(raw) -> Optional[dict]:
    if not raw:
        return None
    if isinstance(raw, dict):
        return raw
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def dump_tgi_detail(detail: Optional[dict]) -> Optional[str]:
    if not detail:
        return None
    return json.dumps(detail, ensure_ascii=False)


def _round(value) -> float:
    return round(float(value or 0), 2)


def _cell_text(fragment: str) -> str:
    text = TAG_RE.sub(" ", fragment)
    text = html.unescape(text)
    return " ".join(text.split())


def _parse_amount(token: str) -> float:
    token = token.strip()
    if "," in token and "." in token:
        if token.rfind(",") > token.rfind("."):
            token = token.replace(".", "").replace(",", ".")
        else:
            token = token.replace(",", "")
    elif "," in token:
        token = token.replace(".", "").replace(",", ".")
    return _round(token)


def _normalize_status(text: str) -> Optional[str]:
    lowered = text.lower()
    if "no exigible" in lowered or "no exig" in lowered:
        return "no_exigible"
    if "pendiente" in lowered:
        return "pendiente"
    if "abonado" in lowered or "pagado" in lowered:
        return "abonado"
    return None


def _capital_and_interest(amounts: list[float], status: str) -> tuple[float, float]:
    if not amounts or status == "abonado":
        return 0.0, 0.0
    capital = amounts[0]
    if status != "pendiente":
        return capital, 0.0
    if len(amounts) == 1:
        return capital, 0.0
    interest = amounts[1]
    if len(amounts) >= 3:
        balance = amounts[-1]
        if balance > 0 and abs((capital + interest) - balance) > 0.05:
            interest = _round(balance - capital)
    if interest < 0:
        interest = 0.0
    return _round(capital), _round(interest)


def parse_siat_html(page: str) -> list[SiatInstallment]:
    installments: list[SiatInstallment] = []
    for row_html in ROW_RE.findall(page or ""):
        cells = [_cell_text(cell) for cell in CELL_RE.findall(row_html)]
        if not cells:
            continue
        period = next((cell for cell in cells if PERIOD_RE.match(cell)), None)
        status = next((_normalize_status(cell) for cell in cells if _normalize_status(cell)), None)
        if not period or not status:
            continue
        kind = "Ajuste" if any(cell.lower() == "ajuste" for cell in cells) else "Original"
        amounts: list[float] = []
        for cell in cells:
            if PERIOD_RE.match(cell):
                continue
            amounts.extend(_parse_amount(token) for token in AMOUNT_RE.findall(cell))
        capital, interest = _capital_and_interest(amounts, status)
        installments.append(
            SiatInstallment(
                period=period,
                kind=kind,
                capital=capital,
                interest=interest,
                status=status,
            )
        )
    return installments


def _error_message(page: str) -> Optional[str]:
    match = ERROR_RE.search(page or "")
    if not match:
        return None
    text = _cell_text(match.group(1))
    return text or None


def fetch_siat_installments(account: str, code: str, timeout: int = 30) -> list[SiatInstallment]:
    account = clean_tgi_account(account)
    code = clean_tgi_code(code)
    if not account or not code:
        raise SiatError("Falta la cuenta o el código de gestión del TGI.")

    jar = CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        login = opener.open(
            urllib.request.Request(SIAT_LOGIN_URL, headers=headers),
            timeout=timeout,
        )
        login_html = login.read().decode("latin-1", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise SiatError("No se pudo consultar el SIAT de Rosario.") from exc

    action_match = re.search(r'action="([^"]+)"', login_html)
    if not action_match:
        raise SiatError("El SIAT no mostró el formulario de consulta.")
    action = action_match.group(1)
    if action.startswith("/"):
        action = SIAT_ORIGIN + action

    payload = urllib.parse.urlencode(
        {
            "cuenta.idRecurso": "14",
            "cuenta.numeroCuenta": account,
            "cuenta.codGesPer": code,
            "method": "ingresarLiqDeudaContr",
            "anonimo": "1",
            "urlReComenzar": "/gde/AdministrarLiqDeuda.do?method=inicializarContr",
            "selectedId": "",
            "isSubmittedForm": "true",
        }
    ).encode()
    request = urllib.request.Request(
        action,
        data=payload,
        headers={
            **headers,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": SIAT_LOGIN_URL,
        },
    )
    try:
        response = opener.open(request, timeout=timeout)
        page = response.read().decode("latin-1", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise SiatError("No se pudo consultar el SIAT de Rosario.") from exc

    installments = parse_siat_html(page)
    if installments:
        return installments
    message = _error_message(page)
    if message:
        raise SiatError(message)
    raise SiatError("El SIAT no devolvió períodos de TGI para esa cuenta.")


def summarize_month(rows: Iterable[SiatInstallment], period: str) -> dict:
    capital = 0.0
    interest = 0.0
    saw_pending = False
    saw_open = False
    saw_paid = False
    for row in rows:
        if row.status == "abonado":
            saw_paid = True
            continue
        if row.status == "pendiente":
            saw_pending = True
            capital += row.capital
            interest += row.interest
        elif row.status == "no_exigible":
            saw_open = True
            capital += row.capital
    if saw_pending:
        status = "pendiente"
    elif saw_open:
        status = "no_exigible"
        interest = 0.0
    elif saw_paid:
        status = "abonado"
        capital = 0.0
        interest = 0.0
    else:
        status = "ausente"
    return {
        "period": period,
        "capital": _round(capital),
        "interest": _round(interest),
        "status": status,
        "total": _round(capital + interest),
    }


def _empty_month(period: str) -> dict:
    return {
        "period": period,
        "capital": 0.0,
        "interest": 0.0,
        "status": "ausente",
        "total": 0.0,
    }


def build_tgi_charge(
    rows: Iterable[SiatInstallment],
    current_month: str,
    assigned: Iterable[str] | None = None,
    locked_catchup: Optional[dict] = None,
    locked_current: Optional[dict] = None,
    fetched_on: Optional[date] = None,
) -> dict:
    """Mes actual + el pendiente más antiguo que no esté ya asignado a otro alquiler.

    Si este período ya tenía un mes de catch-up guardado, se mantiene aunque en el
    SIAT ya figure abonado: así no se corre el cargo al mes siguiente antes de cobrarlo.
    """
    grouped: dict[str, list[SiatInstallment]] = {}
    for row in rows:
        grouped.setdefault(row.period, []).append(row)
    taken = {month for month in (assigned or []) if month}

    if current_month in grouped:
        current = summarize_month(grouped[current_month], current_month)
    else:
        current = _empty_month(current_month)
    kept_current = (
        locked_current
        and locked_current.get("period") == current_month
        and _round(locked_current.get("total")) > 0
    )
    if current["status"] == "abonado" and kept_current:
        current = {
            "period": current_month,
            "capital": _round(locked_current.get("capital")),
            "interest": _round(locked_current.get("interest")),
            "status": locked_current.get("status") or "abonado",
            "total": _round(locked_current.get("total")),
            "kept": True,
        }
    elif current["status"] == "abonado":
        current = {**current, "capital": 0.0, "interest": 0.0, "total": 0.0}

    catchup = None
    locked_period = (locked_catchup or {}).get("period")
    if locked_period and locked_period != current_month:
        if locked_period in grouped:
            fresh = summarize_month(grouped[locked_period], locked_period)
        else:
            fresh = _empty_month(locked_period)
        if fresh["status"] == "pendiente":
            catchup = fresh
        else:
            catchup = {
                "period": locked_period,
                "capital": _round(locked_catchup.get("capital")),
                "interest": _round(locked_catchup.get("interest")),
                "status": locked_catchup.get("status") or fresh["status"],
                "total": _round(locked_catchup.get("total")),
                "kept": True,
            }
    else:
        pending_months = sorted(
            month
            for month, month_rows in grouped.items()
            if month != current_month
            and month not in taken
            and any(row.status == "pendiente" for row in month_rows)
        )
        if pending_months:
            catchup = summarize_month(grouped[pending_months[0]], pending_months[0])

    total = _round(current["total"] + ((catchup or {}).get("total") or 0))
    note = None
    if current["status"] == "ausente":
        note = f"El SIAT no lista el período {current_month}."
    return {
        "fetched_at": (fetched_on or date.today()).isoformat(),
        "current": current,
        "catchup": catchup,
        "total": total,
        "note": note,
    }


def assigned_months_from_details(details: Iterable[Optional[dict]]) -> set[str]:
    taken: set[str] = set()
    for detail in details:
        if not detail or detail.get("manual"):
            continue
        for key in ("current", "catchup"):
            block = detail.get(key) or {}
            period = block.get("period")
            if period:
                taken.add(period)
    return taken
