"""Client for INDEC IPC via Argentina Series de Tiempo API (datos.gob.ar)."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

# IPC-GBA Nivel General, base Dic-2016=100
IPC_SERIES_ID = "103.1_I2N_2016_M_19"
API_BASE = "https://apis.datos.gob.ar/series/api/series"
TIMEOUT_SECONDS = 8


class IpcServiceError(Exception):
    """Raised when the official IPC API cannot be reached or has no data."""


def _parse_period(raw: str) -> date:
    """Parse API time index (YYYY-MM-DD or YYYY-MM) to a date."""
    raw = (raw or "").strip()
    if len(raw) == 7:
        return date.fromisoformat(f"{raw}-01")
    return date.fromisoformat(raw[:10])


def _fetch_series(**params: Any) -> list:
    query = {"ids": IPC_SERIES_ID, "format": "json", "metadata": "none", **params}
    url = f"{API_BASE}?{urlencode(query)}"
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "propertyManager/1.0"})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        raise IpcServiceError(f"Error HTTP al consultar IPC ({e.code})") from e
    except URLError as e:
        raise IpcServiceError(f"No se pudo conectar a la API de IPC: {e.reason}") from e
    except (TimeoutError, json.JSONDecodeError) as e:
        raise IpcServiceError(f"Respuesta inválida de la API de IPC: {e}") from e

    if payload.get("errors"):
        raise IpcServiceError(str(payload["errors"]))

    data = payload.get("data") or []
    if not data:
        raise IpcServiceError("La API de IPC no devolvió datos")
    return data


def _row_to_result(row: list) -> Dict[str, Any]:
    period = _parse_period(str(row[0]))
    value = float(row[1])
    return {
        "value": round(value, 4),
        "period": period.isoformat(),
        "series_id": IPC_SERIES_ID,
        "label": "IPC-GBA Nivel General",
    }


def get_latest_ipc() -> Dict[str, Any]:
    """Return the most recently published IPC index value."""
    data = _fetch_series(last=1)
    return _row_to_result(data[-1])


def get_ipc_for_date(target: date) -> Dict[str, Any]:
    """
    Return IPC for the month of `target`.
    If that month is not published yet, return the latest available value.
    """
    month_start = date(target.year, target.month, 1)
    # Fetch a window ending at target month; API may not have future months.
    end = month_start.isoformat()
    start = date(target.year - 1, target.month, 1).isoformat()
    try:
        data = _fetch_series(start_date=start, end_date=end)
    except IpcServiceError:
        return get_latest_ipc()

    # Prefer exact month match; otherwise last available in the window.
    exact = None
    for row in data:
        period = _parse_period(str(row[0]))
        if period.year == month_start.year and period.month == month_start.month:
            exact = row
    if exact is not None:
        return _row_to_result(exact)
    if data:
        return _row_to_result(data[-1])
    return get_latest_ipc()


def variation_percent(new_value: float, reference_value: float) -> float:
    if reference_value is None or reference_value == 0:
        raise ValueError("El índice de referencia debe ser distinto de cero")
    return round((new_value - reference_value) / reference_value * 100, 4)
