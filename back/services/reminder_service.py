import html as html_lib
import os
from datetime import date, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload

from models.contract import RentalContract
from models.contract_period import ContractPeriod
from models.person import Owner, Tenant
from models.contract_termination import ContractTermination
from models.property import Garage, Property
from models.reminder_log import ReminderLog
from schemas.enums.enums import PaymentStatusEnum
from services.email_service import (
    EmailConfigError,
    reminder_to_email,
    send_email,
    smtp_configured,
)
from utils.contract_display import contract_location_label

_ = (Owner, Tenant, Property, Garage, ContractTermination)

_MONTHS_ES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)

_OPEN_STATUSES = (
    PaymentStatusEnum.PENDIENTE,
    PaymentStatusEnum.POR_VENCER,
    PaymentStatusEnum.VENCIDO,
    PaymentStatusEnum.PARCIAL,
)

KIND_ADMIN = "admin_digest"
KIND_TENANT = "tenant"


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def reminder_days_before() -> int:
    raw = _env("REMINDER_DAYS_BEFORE", "2")
    try:
        return max(0, int(raw))
    except ValueError:
        return 2


def reminder_mode() -> str:
    mode = _env("REMINDER_MODE", "admin_digest").lower()
    if mode in ("tenant", "tenant_individual"):
        return "tenant"
    return "admin_digest"


def reminder_sender_name() -> str:
    return _env("REMINDER_SENDER_NAME", "la administración")


def reminder_whatsapp() -> str:
    return _env("REMINDER_WHATSAPP", "—")


def month_label(value: Optional[date]) -> str:
    if not value:
        return "—"
    return f"{_MONTHS_ES[value.month - 1]} {value.year}"


def _currency_value(contract) -> str:
    currency = getattr(contract, "currency", None) if contract else None
    if hasattr(currency, "value"):
        return currency.value
    text = str(currency or "PESOS").upper()
    if text in ("DOLARES", "USD", "DOLAR"):
        return "DOLARES"
    return "PESOS"


def format_money(amount, currency: str = "PESOS") -> str:
    n = float(amount or 0)
    formatted = f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    prefix = "U$S" if str(currency).upper() in ("DOLARES", "USD") else "$"
    return f"{prefix} {formatted}"


def _status_value(status) -> str:
    return status.value if hasattr(status, "value") else str(status or "")


def _unit_type(contract) -> str:
    if contract and getattr(contract, "property_id", None):
        return "departamento"
    return "garage"


def _period_load():
    return (
        joinedload(ContractPeriod.contract).joinedload(RentalContract.tenant),
        joinedload(ContractPeriod.contract).joinedload(RentalContract.property),
        joinedload(ContractPeriod.contract).joinedload(RentalContract.garage).joinedload(Garage.property),
    )


def _row_from_period(period: ContractPeriod) -> dict[str, Any]:
    contract = period.contract
    tenant = getattr(contract, "tenant", None) if contract else None
    total = float(period.total_amount or 0)
    paid = float(period.amount_paid or 0)
    remaining = max(0.0, round(total - paid, 2))
    currency = _currency_value(contract)
    location = contract_location_label(contract) if contract else "Sin dirección"
    tenant_name = getattr(tenant, "name", None) or "Sin inquilino"
    return {
        "period_id": period.id,
        "contract_id": period.contract_id,
        "tenant_name": tenant_name,
        "tenant_email": getattr(tenant, "email", None),
        "location": location,
        "unit_type": _unit_type(contract),
        "month": month_label(period.start_date),
        "due_date": period.due_date.isoformat() if period.due_date else None,
        "amount": remaining,
        "amount_label": format_money(remaining, currency),
        "currency": currency,
        "payment_status": _status_value(period.payment_status),
        "digest_line": (
            f"{tenant_name} - {location} - {month_label(period.start_date)} - "
            f"{format_money(remaining, currency)}"
        ),
    }


def list_unpaid_due_soon(
    db: Session,
    days: Optional[int] = None,
    today: Optional[date] = None,
) -> list[dict[str, Any]]:
    days = reminder_days_before() if days is None else max(0, int(days))
    today = today or date.today()
    target = today + timedelta(days=days)
    periods = (
        db.query(ContractPeriod)
        .join(RentalContract, ContractPeriod.contract_id == RentalContract.id)
        .options(*_period_load())
        .filter(
            ContractPeriod.due_date == target,
            ContractPeriod.payment_status.in_(_OPEN_STATUSES),
            RentalContract.status == 1,
        )
        .order_by(ContractPeriod.due_date, ContractPeriod.contract_id)
        .all()
    )
    rows = []
    for period in periods:
        total = float(period.total_amount or 0)
        paid = float(period.amount_paid or 0)
        if paid >= total:
            continue
        rows.append(_row_from_period(period))
    return rows


def render_admin_digest(rows: list[dict[str, Any]]) -> str:
    count = len(rows)
    lines = [
        f"Hola, buenos días. {count} alquileres pendientes, vencen en dos días.",
        "",
    ]
    if not rows:
        lines.append("(nadie)")
        return "\n".join(lines)
    for row in rows:
        lines.append(row["digest_line"])
    return "\n".join(lines)


def _format_due_label(value) -> str:
    if not value:
        return "—"
    text = str(value)[:10]
    parts = text.split("-")
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return text


def render_admin_digest_html(rows: list[dict[str, Any]]) -> str:
    count = len(rows)
    if not rows:
        cards_html = """
            <tr>
              <td bgcolor="#ffffff" style="padding:16px;color:#555555;font-style:italic;font-family:Arial,Helvetica,sans-serif;">
                No hay alquileres pendientes.
              </td>
            </tr>
        """
    else:
        chunks = []
        for i, row in enumerate(rows):
            bg = "#ffffff" if i % 2 == 0 else "#f3f6fa"
            tenant = html_lib.escape(str(row.get("tenant_name") or "Sin inquilino"))
            location = html_lib.escape(str(row.get("location") or "—"))
            month = html_lib.escape(str(row.get("month") or "—"))
            due = html_lib.escape(_format_due_label(row.get("due_date")))
            amount = html_lib.escape(str(row.get("amount_label") or "—"))
            border = "border-bottom:1px solid #d8dee6;" if i < count - 1 else ""
            chunks.append(
                f"""
            <tr>
              <td bgcolor="{bg}" style="padding:14px 12px;{border}font-family:Arial,Helvetica,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="top" style="font-family:Arial,Helvetica,sans-serif;padding-right:12px;">
                      <div style="font-size:15px;font-weight:700;color:#1a1a1a;line-height:1.3;">{tenant}</div>
                      <div style="font-size:13px;color:#444444;line-height:1.4;padding-top:4px;">{location}</div>
                      <div style="font-size:12px;color:#666666;padding-top:4px;">{month} · vence {due}</div>
                    </td>
                    <td valign="top" align="right" width="130" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#1f4e79;white-space:nowrap;">
                      {amount}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
                """
            )
        cards_html = "".join(chunks)

    subtitle = (
        f"{count} alquiler{'es' if count != 1 else ''} pendiente{'s' if count != 1 else ''} · vencen en dos días"
        if count
        else "Nadie tiene vencimiento en dos días"
    )
    preheader = html_lib.escape(subtitle)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Alquileres por vencer</title>
</head>
<body bgcolor="#eef2f6" style="margin:0;padding:0;background-color:#eef2f6;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f6">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:560px;width:100%;">
          <tr>
            <td bgcolor="#1f4e79" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
              <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;">Gestión Inmobiliaria</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;padding-top:6px;">Alquileres por vencer</div>
              <div style="font-size:14px;color:#ffffff;padding-top:6px;">{html_lib.escape(subtitle)}</div>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="padding:16px 20px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#333333;">
              Hola, buenos días. Estos inquilinos todavía no pagaron y el vencimiento es en <strong>dos días</strong>.
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="padding:8px 12px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border:1px solid #d8dee6;">
                {cards_html}
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="padding:4px 20px 18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;">
              Mail automático. No responder.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_tenant_reminder(row: dict[str, Any]) -> str:
    tenant = row.get("tenant_name") or "inquilino"
    sender = reminder_sender_name()
    unit = row.get("unit_type") or "departamento"
    location = row.get("location") or "la unidad"
    whatsapp = reminder_whatsapp()
    return (
        f"Hola {tenant}, te habla {sender} por el {unit} de {location}. "
        "Te queríamos avisar que faltan dos días para el vencimiento del pago del alquiler. "
        f"Estamos atentos ante cualquier consulta, nuestro wpp es {whatsapp}. No responder."
    )


def already_sent(db: Session, period_id: int, kind: str, sent_on: date) -> bool:
    return (
        db.query(ReminderLog)
        .filter(
            ReminderLog.period_id == period_id,
            ReminderLog.kind == kind,
            ReminderLog.sent_on == sent_on,
        )
        .first()
        is not None
    )


def _log_send(db: Session, period_id: int, kind: str, sent_on: date, recipient: str) -> None:
    db.add(
        ReminderLog(
            period_id=period_id,
            kind=kind,
            sent_on=sent_on,
            recipient=recipient,
        )
    )


def preview_due_reminders(db: Session, days: Optional[int] = None) -> dict[str, Any]:
    days = reminder_days_before() if days is None else max(0, int(days))
    rows = list_unpaid_due_soon(db, days=days)
    today = date.today()
    target = today + timedelta(days=days)
    return {
        "days_before": days,
        "due_date": target.isoformat(),
        "mode": reminder_mode(),
        "smtp_configured": smtp_configured(),
        "recipient": reminder_to_email() or None,
        "count": len(rows),
        "body": render_admin_digest(rows),
        "html_body": render_admin_digest_html(rows),
        "rows": rows,
        "tenant_previews": [
            {
                "period_id": row["period_id"],
                "to": row.get("tenant_email"),
                "body": render_tenant_reminder(row),
            }
            for row in rows
        ],
    }


def send_due_reminders(db: Session, days: Optional[int] = None) -> dict[str, Any]:
    days = reminder_days_before() if days is None else max(0, int(days))
    today = date.today()
    rows = list_unpaid_due_soon(db, days=days, today=today)
    mode = reminder_mode()
    kind = KIND_TENANT if mode == "tenant" else KIND_ADMIN

    pending = [row for row in rows if not already_sent(db, row["period_id"], kind, today)]
    result = {
        "sent": False,
        "mode": mode,
        "days_before": days,
        "count": len(pending),
        "skipped": len(rows) - len(pending),
        "recipient": reminder_to_email() or None,
        "body": render_admin_digest(pending) if pending else "",
        "html_body": render_admin_digest_html(pending) if pending else "",
        "reason": None,
        "sent_to": [],
    }
    if not pending:
        result["reason"] = "No hay impagos por avisar (o ya se envió hoy)."
        return result

    if mode == "tenant":
        sent_to = []
        errors = []
        for row in pending:
            to_addr = (row.get("tenant_email") or "").strip()
            if not to_addr:
                errors.append(f"Período {row['period_id']}: el inquilino no tiene email.")
                continue
            try:
                send_email(
                    to_addr,
                    "Aviso de vencimiento de alquiler",
                    render_tenant_reminder(row),
                )
            except EmailConfigError as exc:
                result["reason"] = str(exc)
                return result
            except Exception as exc:
                errors.append(f"Período {row['period_id']}: {exc}")
                continue
            _log_send(db, row["period_id"], KIND_TENANT, today, to_addr)
            sent_to.append(to_addr)
        db.commit()
        result["sent"] = bool(sent_to)
        result["sent_to"] = sent_to
        result["count"] = len(sent_to)
        result["reason"] = None if sent_to else ("; ".join(errors) or "No se pudo enviar.")
        if errors and sent_to:
            result["reason"] = "; ".join(errors)
        return result

    recipient = reminder_to_email()
    if not smtp_configured() or not recipient:
        result["reason"] = "Falta configurar SMTP y REMINDER_TO_EMAIL."
        print(f"[reminders] {result['reason']}", flush=True)
        return result

    body = render_admin_digest(pending)
    html_body = render_admin_digest_html(pending)
    subject = "Alquileres por vencer — faltan dos días"
    try:
        send_email(recipient, subject, body, html_body=html_body)
    except Exception as exc:
        result["reason"] = f"No se pudo enviar el mail: {exc}"
        print(f"[reminders] ERROR: {exc}", flush=True)
        return result

    for row in pending:
        _log_send(db, row["period_id"], KIND_ADMIN, today, recipient)
    db.commit()
    result["sent"] = True
    result["body"] = body
    result["sent_to"] = [recipient]
    return result
