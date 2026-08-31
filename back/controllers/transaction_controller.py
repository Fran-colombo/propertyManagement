from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from models.transaction_history import TransactionHistory
from controllers.contract_period_controller import PaymentData
from database import get_db
from models.contract_period import ContractPeriod
from models.transactions import Transaction
from schemas.enums.enums import PaymentStatusEnum
from services.transaction_service import TransactionService, normalize_currency, normalize_received_by
from schemas.transactionDTO import (
    TransactionHistoryResponse,
    TransactionResponseDTO,
    PaginatedTransactionHistoryResponse,
)
from utils.contract_display import contract_location_label, contract_owner

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _status_value(status) -> str:
    return status.value if hasattr(status, "value") else str(status or "")


def _payment_status(amount_paid: float, total_amount: float) -> str:
    if amount_paid >= total_amount:
        return PaymentStatusEnum.PAGADO.value
    if amount_paid > 0:
        return PaymentStatusEnum.PARCIAL.value
    return PaymentStatusEnum.PENDIENTE.value


def _period_label(period: ContractPeriod) -> str:
    return f"{period.start_date.strftime('%d/%m/%Y')} - {period.end_date.strftime('%d/%m/%Y')}"


def _join_notes(*parts: Optional[str]) -> Optional[str]:
    chunks = [p.strip() for p in parts if p and str(p).strip()]
    return " ".join(chunks) if chunks else None


def _add_ledger_entry(
    db: Session,
    period: ContractPeriod,
    amount: float,
    method: str,
    notes: Optional[str],
    received_by: Optional[str] = None,
    remitted_to_owner: Optional[bool] = None,
) -> Transaction:
    remaining_before = (period.total_amount or 0) - (period.amount_paid or 0)
    transaction = Transaction(
        period_id=period.id,
        amount=amount,
        date=date.today(),
        method=method,
        notes=notes,
        remaining_amount=remaining_before - amount,
    )
    db.add(transaction)
    db.flush()

    new_paid = max(0.0, (period.amount_paid or 0) + amount)
    new_status = _payment_status(new_paid, period.total_amount or 0)
    contract = period.contract
    owner = contract_owner(contract)
    tenant = contract.tenant if contract else None
    receiver = normalize_received_by(received_by)
    if remitted_to_owner is None:
        remitted = receiver != "INTERMEDIARIO"
    else:
        remitted = bool(remitted_to_owner)

    db.add(
        TransactionHistory(
            transaction_id=transaction.id,
            amount=amount,
            date=date.today(),
            method=method,
            notes=notes,
            contract_id=contract.id if contract else None,
            owner_id=owner.id if owner else None,
            owner_name=owner.name if owner else "Sin dueño",
            tenant_id=tenant.id if tenant else None,
            tenant_name=tenant.name if tenant else "Sin inquilino",
            property_direction=contract_location_label(contract),
            period_id=period.id,
            period_start_date=period.start_date,
            period_end_date=period.end_date,
            period_due_date=period.due_date,
            period_total_amount=period.total_amount,
            period_amount_paid=min(new_paid, period.total_amount or 0),
            period_payment_status=new_status,
            currency=normalize_currency(getattr(contract, "currency", None) if contract else None),
            received_by=receiver,
            remitted_to_owner=1 if remitted else 0,
            remitted_at=date.today() if remitted and receiver == "INTERMEDIARIO" else None,
        )
    )

    period.amount_paid = min(new_paid, period.total_amount or 0)
    period.payment_status = new_status
    period.payment_date = date.today()
    period.payment_method = method
    period.payment_reference = notes
    return transaction


def _next_open_period(db: Session, period: ContractPeriod) -> Optional[ContractPeriod]:
    nxt = (
        db.query(ContractPeriod)
        .filter(
            ContractPeriod.contract_id == period.contract_id,
            ContractPeriod.start_date > period.start_date,
        )
        .order_by(ContractPeriod.start_date.asc())
        .first()
    )
    if not nxt:
        return None
    status = _status_value(nxt.payment_status)
    if status in (
        PaymentStatusEnum.PAGADO.value,
        PaymentStatusEnum.CONTRATO_TERMINADO.value,
    ):
        return None
    return nxt


class CreditNoteData(BaseModel):
    amount: float = Field(gt=0)
    notes: str = Field(min_length=3)
    received_by: Optional[str] = None
    remitted_to_owner: Optional[bool] = None


@router.post("/{period_id}/payments")
def register_payment(period_id: int, payment: PaymentData, db: Session = Depends(get_db)):
    period = db.query(ContractPeriod).get(period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")

    if _status_value(period.payment_status) == PaymentStatusEnum.PAGADO.value:
        raise HTTPException(status_code=400, detail="Este período ya está pagado")

    remaining = max(0.0, (period.total_amount or 0) - (period.amount_paid or 0))
    extra = round(payment.amount - remaining, 2)
    reason = (payment.overpay_reason or "").strip().lower() or None
    extra_note = (payment.overpay_note or "").strip()
    reference = payment.reference

    receiver = payment.received_by

    if extra > 0.009 and reason not in ("adelanto", "otro"):
        raise HTTPException(
            status_code=400,
            detail="El monto supera el saldo. Indicá si es adelanto u otro motivo.",
        )
    if reason == "otro" and extra > 0.009 and not extra_note:
        raise HTTPException(
            status_code=400,
            detail="Si no es adelanto, especificá por qué se pagó de más.",
        )

    if extra <= 0.009:
        _add_ledger_entry(
            db, period, payment.amount, payment.method, reference, received_by=receiver
        )
        db.commit()
        return {
            "message": "Pago registrado correctamente",
            "remaining_amount": (period.total_amount or 0) - (period.amount_paid or 0),
        }

    if reason == "adelanto":
        nxt = _next_open_period(db, period)
        if not nxt:
            raise HTTPException(
                status_code=400,
                detail="No hay un mes siguiente disponible para el adelanto. Elegí Otro o Cancelar.",
            )
        next_remaining = max(0.0, (nxt.total_amount or 0) - (nxt.amount_paid or 0))
        if extra > next_remaining + 0.009:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El adelanto (${extra:,.2f}) supera el saldo del mes siguiente "
                    f"(${next_remaining:,.2f})."
                ),
            )
        current_note = _join_notes(
            reference,
            f"Pago del período. Incluye adelanto de ${extra:,.2f} al mes siguiente.",
        )
        if remaining > 0.009:
            _add_ledger_entry(
                db, period, remaining, payment.method, current_note, received_by=receiver
            )
        advance_note = _join_notes(
            f"Adelanto. Sobra de la transferencia del período {_period_label(period)}.",
            reference,
        )
        _add_ledger_entry(
            db, nxt, extra, payment.method, advance_note, received_by=receiver
        )
        db.commit()
        return {
            "message": "Pago y adelanto registrados correctamente",
            "remaining_amount": (period.total_amount or 0) - (period.amount_paid or 0),
            "advance_period_id": nxt.id,
            "advance_amount": extra,
        }

    overpay_note = _join_notes(
        reference,
        f"Pago de más (${extra:,.2f}): {extra_note}",
    )
    _add_ledger_entry(
        db, period, payment.amount, payment.method, overpay_note, received_by=receiver
    )
    db.commit()
    return {
        "message": "Pago registrado correctamente",
        "remaining_amount": (period.total_amount or 0) - (period.amount_paid or 0),
    }


@router.post("/{period_id}/credit-notes")
def register_credit_note(period_id: int, data: CreditNoteData, db: Session = Depends(get_db)):
    period = db.query(ContractPeriod).get(period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    paid = period.amount_paid or 0
    if data.amount > paid + 0.009:
        raise HTTPException(
            status_code=400,
            detail="La nota de crédito no puede superar lo pagado en el período.",
        )
    note = _join_notes("Nota de crédito. Se cargó por error.", data.notes)
    _add_ledger_entry(
        db,
        period,
        -abs(data.amount),
        "nota_credito",
        note,
        received_by=data.received_by,
        remitted_to_owner=data.remitted_to_owner,
    )
    db.commit()
    return {
        "message": "Nota de crédito registrada",
        "remaining_amount": (period.total_amount or 0) - (period.amount_paid or 0),
    }


@router.post("/history/{history_id}/remit", response_model=TransactionHistoryResponse)
def remit_to_owner(history_id: int, db: Session = Depends(get_db)):
    service = TransactionService(db)
    return service.mark_remitted(history_id)


@router.get("/", response_model=PaginatedTransactionHistoryResponse)
def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None),
    month: Optional[str] = Query(None, description="YYYY-MM, vacío lista todas"),
    method: Optional[str] = Query(None),
    remittance: Optional[str] = Query(
        None, description="pending | remitted | owner"
    ),
    db: Session = Depends(get_db),
):
    if month:
        parts = month.split("-")
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            raise HTTPException(status_code=400, detail="El mes debe ser YYYY-MM")
        month_num = int(parts[1])
        if month_num < 1 or month_num > 12:
            raise HTTPException(status_code=400, detail="Mes inválido")
    if remittance and remittance not in ("pending", "remitted", "owner"):
        raise HTTPException(
            status_code=400,
            detail="Rendición inválida. Usá pending, remitted u owner.",
        )
    service = TransactionService(db)
    return service.get_paginated_history(
        page=page,
        page_size=page_size,
        q=q,
        month=month or None,
        method=method or None,
        remittance=remittance or None,
    )


@router.get("/period/{period_id}", response_model=List[TransactionHistoryResponse])
def get_transactions_by_period(period_id: int, db: Session = Depends(get_db)):
    service = TransactionService(db)
    return service.get_history_by_period(period_id)


@router.get("/original/{period_id}", response_model=List[TransactionResponseDTO])
def get_original_transactions_by_period(period_id: int, db: Session = Depends(get_db)):
    service = TransactionService(db)
    transactions = service.get_by_period(period_id)
    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found for this period")
    return transactions
