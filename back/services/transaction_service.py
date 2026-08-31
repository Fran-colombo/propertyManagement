from datetime import date
from math import ceil
from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models.transaction_history import TransactionHistory
from models.transactions import Transaction
from schemas.transactionDTO import (
    TransactionHistoryResponse,
    TransactionResponseDTO,
    SimpleUser,
    ContractInfo,
    PeriodInfo,
    PaginatedTransactionHistoryResponse,
)


def normalize_currency(value) -> str:
    if hasattr(value, "value"):
        value = value.value
    text = str(value or "PESOS").strip().upper()
    if text in ("DOLARES", "USD", "DOLAR"):
        return "DOLARES"
    return "PESOS"


def normalize_received_by(value) -> str:
    if hasattr(value, "value"):
        value = value.value
    text = str(value or "DUENO").strip().upper().replace("Ñ", "N").replace("Ó", "O")
    if text in ("INTERMEDIARIO", "AGENCIA", "YO", "ADMINISTRACION"):
        return "INTERMEDIARIO"
    return "DUENO"


def is_remitted(record: TransactionHistory) -> bool:
    if record.remitted_to_owner is None:
        return normalize_received_by(record.received_by) != "INTERMEDIARIO"
    return bool(record.remitted_to_owner)


def pending_remittance_filters():
    received = func.upper(func.coalesce(TransactionHistory.received_by, "DUENO"))
    return [
        received == "INTERMEDIARIO",
        or_(
            TransactionHistory.remitted_to_owner == False,
            TransactionHistory.remitted_to_owner == 0,
        ),
    ]


class TransactionService:
    def __init__(self, db: Session):
        self.db = db

    def _history_filters(
        self,
        q: str | None,
        month: str | None,
        method: str | None,
        remittance: str | None = None,
    ):
        filters = []
        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(func.coalesce(TransactionHistory.tenant_name, "")).like(term),
                    func.lower(func.coalesce(TransactionHistory.owner_name, "")).like(term),
                    func.lower(func.coalesce(TransactionHistory.property_direction, "")).like(term),
                    func.lower(func.coalesce(TransactionHistory.notes, "")).like(term),
                )
            )
        if month:
            year_s, month_s = month.split("-")
            year, month_num = int(year_s), int(month_s)
            start = date(year, month_num, 1)
            end = date(year + 1, 1, 1) if month_num == 12 else date(year, month_num + 1, 1)
            filters.append(TransactionHistory.date >= start)
            filters.append(TransactionHistory.date < end)
        if method and method.strip():
            filters.append(func.lower(TransactionHistory.method) == method.strip().lower())
        remittance = (remittance or "").strip().lower()
        received = func.upper(func.coalesce(TransactionHistory.received_by, "DUENO"))
        if remittance == "pending":
            filters.extend(pending_remittance_filters())
        elif remittance == "remitted":
            filters.append(received == "INTERMEDIARIO")
            filters.append(TransactionHistory.remitted_to_owner == 1)
        elif remittance == "owner":
            filters.append(received != "INTERMEDIARIO")
        return filters

    def _sum_by_currency(self, query, extra_filters=None):
        filtered = query.filter(*extra_filters) if extra_filters else query
        currency_norm = func.upper(func.coalesce(TransactionHistory.currency, "PESOS"))
        is_usd = currency_norm == "DOLARES"
        total_dolares = float(
            filtered.filter(is_usd)
            .with_entities(func.coalesce(func.sum(TransactionHistory.amount), 0.0))
            .scalar()
            or 0
        )
        total_pesos = float(
            filtered.filter(~is_usd)
            .with_entities(func.coalesce(func.sum(TransactionHistory.amount), 0.0))
            .scalar()
            or 0
        )
        return total_pesos, total_dolares

    def get_paginated_history(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        q: str | None = None,
        month: str | None = None,
        method: str | None = None,
        remittance: str | None = None,
    ) -> PaginatedTransactionHistoryResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        query = self.db.query(TransactionHistory)
        filters = self._history_filters(q, month, method, remittance)
        if filters:
            query = query.filter(*filters)

        total = query.count()
        total_pesos, total_dolares = self._sum_by_currency(query)

        pending_base = self.db.query(TransactionHistory)
        pending_filters = self._history_filters(q, month, method, remittance=None)
        if pending_filters:
            pending_base = pending_base.filter(*pending_filters)
        pending_pesos, pending_dolares = self._sum_by_currency(
            pending_base, pending_remittance_filters()
        )

        items = (
            query.order_by(TransactionHistory.date.desc(), TransactionHistory.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        pages = ceil(total / page_size) if page_size and total else 0
        return PaginatedTransactionHistoryResponse(
            items=[self._history_to_dto(record) for record in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            total_pesos=float(total_pesos or 0),
            total_dolares=float(total_dolares or 0),
            pending_pesos=float(pending_pesos or 0),
            pending_dolares=float(pending_dolares or 0),
        )

    def get_all_history(self) -> list[TransactionHistoryResponse]:
        """Obtiene todas las transacciones del historial"""
        history_records = self.db.query(TransactionHistory).order_by(TransactionHistory.date.desc()).all()
        return [self._history_to_dto(record) for record in history_records]

    def get_history_by_period(self, period_id: int) -> list[TransactionHistoryResponse]:
        """Obtiene transacciones del historial por período"""
        history_records = self.db.query(TransactionHistory).filter(
            TransactionHistory.period_id == period_id
        ).order_by(TransactionHistory.date.desc()).all()
        return [self._history_to_dto(record) for record in history_records]

    def _history_to_dto(self, record: TransactionHistory) -> TransactionHistoryResponse:
        """Convierte un registro de historial a DTO"""
        total_amount = record.period_total_amount or 0
        amount_paid = record.period_amount_paid or 0
        fallback_date = record.date or date.today()
        return TransactionHistoryResponse(
            id=record.transaction_id,
            amount=record.amount or 0,
            date=fallback_date,
            method=record.method,
            notes=record.notes,
            currency=normalize_currency(record.currency),
            history_id=record.id or 0,
            received_by=normalize_received_by(record.received_by),
            remitted_to_owner=is_remitted(record),
            remitted_at=record.remitted_at,
            contract=ContractInfo(
                id=record.contract_id or 0,
                owner=SimpleUser(id=record.owner_id or 0, name=record.owner_name or "Sin dueño"),
                tenant=SimpleUser(id=record.tenant_id or 0, name=record.tenant_name or "Sin inquilino"),
                property_direction=record.property_direction or "Sin dirección"
            ),
            period=PeriodInfo(
                id=record.period_id or 0,
                start_date=record.period_start_date or fallback_date,
                end_date=record.period_end_date or fallback_date,
                due_date=record.period_due_date or fallback_date,
                total_amount=total_amount,
                payment_status=record.period_payment_status or "",
                amount_paid=amount_paid,
                remaining_amount=total_amount - amount_paid
            )
        )

    def mark_remitted(self, history_id: int) -> TransactionHistoryResponse:
        record = (
            self.db.query(TransactionHistory)
            .filter(TransactionHistory.id == history_id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=404, detail="Transacción no encontrada")
        if normalize_received_by(record.received_by) != "INTERMEDIARIO":
            raise HTTPException(
                status_code=400,
                detail="Solo se rinden cobros del intermediario.",
            )
        if is_remitted(record):
            raise HTTPException(status_code=400, detail="Ese cobro ya fue rendido al dueño.")
        if (record.amount or 0) <= 0:
            raise HTTPException(status_code=400, detail="No se puede rendir una nota de crédito.")
        record.remitted_to_owner = 1
        record.remitted_at = date.today()
        self.db.commit()
        self.db.refresh(record)
        return self._history_to_dto(record)

    def get_all(self) -> list[TransactionResponseDTO]:
        """Obtiene todas las transacciones (método original)"""
        txs = self.db.query(Transaction).all()
        return [self._to_dto(tx) for tx in txs]

    def get_by_period(self, period_id: int) -> list[TransactionResponseDTO]:
        """Obtiene transacciones por período (método original)"""
        txs = self.db.query(Transaction).filter(
            Transaction.period_id == period_id
        ).all()
        return [self._to_dto(tx) for tx in txs]
    
    def _to_dto(self, tx: Transaction) -> TransactionResponseDTO:
        default_contract = ContractInfo(
            id=0,
            owner=SimpleUser(id=0, name="Unknown Owner"),
            tenant=SimpleUser(id=0, name="Unknown Tenant"),
            property_direction="Unknown Property"
        )

        try:
            contract = tx.period.contract if hasattr(tx, 'period') and tx.period else None
            
            if contract:
                owner = SimpleUser(id=0, name="Unknown Owner")
                if hasattr(contract, 'property') and contract.property and hasattr(contract.property, 'owner'):
                    if contract.property.owner:
                        owner = SimpleUser(
                            id=contract.property.owner.id,
                            name=contract.property.owner.name
                        )

                tenant = SimpleUser(id=0, name="Unknown Tenant")
                if hasattr(contract, 'tenant') and contract.tenant:
                    tenant = SimpleUser(
                        id=contract.tenant.id,
                        name=contract.tenant.name
                    )

                property_direction = "Unknown Property"
                if hasattr(contract, 'property') and contract.property and hasattr(contract.property, 'direction'):
                    property_direction = contract.property.direction

                contract_info = ContractInfo(
                    id=contract.id,
                    owner=owner,
                    tenant=tenant,
                    property_direction=property_direction
                )
            else:
                contract_info = default_contract

            period_info = PeriodInfo(
                id=tx.period.id if hasattr(tx, 'period') and tx.period else 0,
                start_date=tx.period.start_date if hasattr(tx, 'period') and tx.period else date.today(),
                end_date=tx.period.end_date if hasattr(tx, 'period') and tx.period else date.today(),
                due_date=tx.period.due_date if hasattr(tx, 'period') and tx.period else date.today(),
                payment_status=tx.period.payment_status if hasattr(tx, 'period') and tx.period else "UNKNOWN",
                total_amount=tx.period.total_amount if hasattr(tx, 'period') and tx.period else 0,
                amount_paid=tx.period.amount_paid if hasattr(tx, 'period') and tx.period else 0,
                remaining_amount=(tx.period.total_amount - tx.period.amount_paid) if hasattr(tx, 'period') and tx.period else 0
            )

            return TransactionResponseDTO(
                id=tx.id,
                amount=tx.amount,
                date=tx.date,
                method=tx.method,
                notes=tx.notes,
                remaining_amount=tx.remaining_amount,
                contract=contract_info,
                period=period_info
            )

        except Exception as e:
            return TransactionResponseDTO(
                id=tx.id,
                amount=tx.amount,
                date=tx.date,
                method=tx.method,
                notes=tx.notes,
                remaining_amount=tx.remaining_amount,
                contract=default_contract,
                period=PeriodInfo(
                    id=0,
                    start_date=date.today(),
                    end_date=date.today(),
                    due_date=date.today(),
                    payment_status="UNKNOWN",
                    total_amount=0,
                    amount_paid=0,
                    remaining_amount=0
                )
            )
        
    