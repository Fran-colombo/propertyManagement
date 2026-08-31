import calendar
from datetime import date


def month_days(d: date) -> int:
    return calendar.monthrange(d.year, d.month)[1]


def occupied_days(start: date, end: date) -> int:
    return (end - start).days + 1


def is_partial_month(start: date, end: date) -> bool:
    return occupied_days(start, end) < month_days(start)


def prorate(full_amount: float, start: date, end: date) -> float:
    days = occupied_days(start, end)
    total = month_days(start)
    if total <= 0 or days >= total:
        return round(full_amount or 0, 2)
    return round((full_amount or 0) * days / total, 2)


def proration_note(start: date, end: date) -> str | None:
    days = occupied_days(start, end)
    total = month_days(start)
    if days >= total:
        return None
    return f"Alquiler proporcional: {days} de {total} días"


def period_rent(period, full_month_amount=None) -> float:
    full = (
        full_month_amount
        if full_month_amount is not None
        else (period.indexed_amount if period.indexed_amount is not None else period.base_rent)
    )
    if getattr(period, "is_prorated", False):
        return prorate(full, period.start_date, period.end_date)
    return round(full or 0, 2)


def period_tax_total(period) -> float:
    return sum(
        amount or 0
        for amount in [
            getattr(period, "epe_amount", 0),
            getattr(period, "tgi_amount", 0),
            getattr(period, "api_amount", 0),
            getattr(period, "fire_proof_amount", 0),
        ]
    )


def period_total(period, full_month_amount=None) -> float:
    return (
        period_rent(period, full_month_amount)
        + period_tax_total(period)
        + (getattr(period, "late_fee_amount", 0) or 0)
    )


DEFAULT_LATE_FEE_DAILY_PERCENT = 2.5


def period_due_date(start: date, end: date) -> date:
    """Due date is the 10th of the period's month, clamped to occupancy."""
    last = calendar.monthrange(start.year, start.month)[1]
    due = date(start.year, start.month, min(10, last))
    if start > due:
        return start
    if end < due:
        return end
    return due


def days_overdue(due: date | None, today: date | None = None) -> int:
    if not due:
        return 0
    today = today or date.today()
    if due >= today:
        return 0
    return (today - due).days


def late_fee_from_daily_rate(
    unpaid_principal: float,
    days: int,
    daily_percent: float = DEFAULT_LATE_FEE_DAILY_PERCENT,
) -> float:
    if days <= 0 or unpaid_principal <= 0 or daily_percent <= 0:
        return 0.0
    return round(unpaid_principal * (daily_percent / 100.0) * days, 2)
