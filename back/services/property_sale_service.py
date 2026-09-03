from datetime import date
from math import ceil
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, extract, func, or_
from sqlalchemy.orm import Session, joinedload

from models.person import Owner
from models.property import Property
from models.property_sale import PropertySale, PropertySalePayment
from models.transaction_history import TransactionHistory
from schemas.saleDTO import (
    CollectSalePaymentDTO,
    PaginatedSalesResponse,
    PropertySaleResponse,
    SaleInstallmentResponse,
    SellPropertyDTO,
)
from services.transaction_service import normalize_currency, normalize_received_by


def _round2(value) -> float:
    return round(float(value or 0), 2)


def _sale_payment_status(total: float, paid: float) -> str:
    if paid + 0.009 >= total:
        return "PAGADA"
    if paid > 0.009:
        return "PARCIAL"
    return "PENDIENTE"


def _normalize_kind(value) -> str:
    text = str(value or "cuota").strip().lower()
    if text in ("adelanto", "advance", "down_payment"):
        return "adelanto"
    return "cuota"


def _installment_remaining(inst: PropertySalePayment) -> float:
    return max(0.0, _round2((inst.amount or 0) - (inst.amount_paid or 0)))


def _installment_sort_key(inst: PropertySalePayment):
    adelanto_first = 0 if _normalize_kind(getattr(inst, "kind", None)) == "adelanto" else 1
    return (adelanto_first, inst.due_date or date.max, inst.id or 0)


class PropertySaleService:
    def __init__(self, db: Session):
        self.db = db

    def _property_label(self, prop: Property) -> str:
        parts = [prop.direction or "Sin dirección"]
        if prop.floor:
            parts.append(f"Piso {prop.floor}")
        if prop.apartment:
            parts.append(f"Depto {prop.apartment}")
        return " · ".join(parts)

    def _to_response(self, sale: PropertySale) -> PropertySaleResponse:
        paid = _round2(sum(inst.amount_paid or 0 for inst in sale.installments))
        total = _round2(sale.total_amount)
        prop = sale.property
        seller = sale.seller
        buyer = sale.buyer
        return PropertySaleResponse(
            id=sale.id,
            property_id=sale.property_id,
            property_direction=self._property_label(prop) if prop else "Sin dirección",
            seller_owner_id=sale.seller_owner_id,
            seller_name=seller.name if seller else None,
            buyer_owner_id=sale.buyer_owner_id,
            buyer_name=sale.buyer_name or (buyer.name if buyer else None),
            sale_date=sale.sale_date,
            currency=normalize_currency(sale.currency),
            total_amount=total,
            amount_paid=paid,
            remaining=max(0.0, _round2(total - paid)),
            keep_managing=bool(sale.keep_managing),
            status=sale.status,
            notes=sale.notes,
            installments=[
                SaleInstallmentResponse(
                    id=inst.id,
                    due_date=inst.due_date,
                    amount=_round2(inst.amount),
                    amount_paid=_round2(inst.amount_paid),
                    remaining=max(0.0, _round2((inst.amount or 0) - (inst.amount_paid or 0))),
                    paid_at=inst.paid_at,
                    method=inst.method,
                    received_by=inst.received_by,
                    notes=inst.notes,
                    kind=_normalize_kind(getattr(inst, "kind", None)),
                )
                for inst in sorted(sale.installments, key=_installment_sort_key)
            ],
        )

    def _load_sale(self, sale_id: int) -> PropertySale:
        sale = (
            self.db.query(PropertySale)
            .options(
                joinedload(PropertySale.property),
                joinedload(PropertySale.seller),
                joinedload(PropertySale.buyer),
                joinedload(PropertySale.installments),
            )
            .filter(PropertySale.id == sale_id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        return sale

    def _sale_paid_total(self, sale_id: int) -> float:
        self.db.flush()
        return _round2(
            self.db.query(func.coalesce(func.sum(PropertySalePayment.amount_paid), 0.0))
            .filter(PropertySalePayment.sale_id == sale_id)
            .scalar()
        )

    def _sync_sale_history(self, sale: PropertySale) -> None:
        paid = self._sale_paid_total(sale.id)
        status = _sale_payment_status(sale.total_amount or 0, paid)
        sale.status = status
        (
            self.db.query(TransactionHistory)
            .filter(TransactionHistory.sale_id == sale.id)
            .update(
                {
                    TransactionHistory.period_amount_paid: paid,
                    TransactionHistory.period_total_amount: sale.total_amount,
                    TransactionHistory.period_payment_status: status,
                },
                synchronize_session=False,
            )
        )

    def _refresh_sale_status(self, sale: PropertySale) -> None:
        paid = self._sale_paid_total(sale.id)
        sale.status = _sale_payment_status(sale.total_amount or 0, paid)
        self._sync_sale_history(sale)

    def _record_history(
        self,
        sale: PropertySale,
        inst: PropertySalePayment,
        amount: float,
        paid_at: date,
        method: str,
        received_by: str,
        notes: Optional[str],
    ) -> None:
        prop = sale.property
        seller = sale.seller
        buyer_name = sale.buyer_name or (sale.buyer.name if sale.buyer else "Comprador")
        receiver = normalize_received_by(received_by)
        remitted = receiver != "INTERMEDIARIO"
        paid_total = self._sale_paid_total(sale.id)
        self.db.add(
            TransactionHistory(
                transaction_id=None,
                amount=amount,
                date=paid_at,
                method="venta",
                notes=notes
                or (
                    "Venta de propiedad. Adelanto pactado."
                    if _normalize_kind(getattr(inst, "kind", None)) == "adelanto"
                    else f"Venta de propiedad. Cuota vto {inst.due_date.isoformat()}."
                ),
                contract_id=None,
                owner_id=seller.id if seller else None,
                owner_name=seller.name if seller else "Dueño vendedor",
                tenant_id=sale.buyer_owner_id,
                tenant_name=buyer_name,
                property_direction=self._property_label(prop) if prop else "Sin dirección",
                period_id=None,
                period_start_date=sale.sale_date,
                period_end_date=inst.due_date,
                period_due_date=inst.due_date,
                period_total_amount=sale.total_amount,
                period_amount_paid=paid_total,
                period_payment_status=_sale_payment_status(sale.total_amount or 0, paid_total),
                currency=normalize_currency(sale.currency),
                received_by=receiver,
                remitted_to_owner=1 if remitted else 0,
                remitted_at=paid_at if remitted else None,
                sale_id=sale.id,
            )
        )
        self.db.flush()
        self._sync_sale_history(sale)

    def sell_property(self, property_id: int, data: SellPropertyDTO) -> PropertySaleResponse:
        prop = (
            self.db.query(Property)
            .options(joinedload(Property.owner), joinedload(Property.garages), joinedload(Property.rental_contract))
            .filter(Property.id == property_id, Property.status == 1)
            .first()
        )
        if not prop:
            raise HTTPException(status_code=404, detail="Propiedad no encontrada")
        mgmt = (prop.management_status or "ACTIVE").upper()
        if mgmt == "SOLD_OUT":
            raise HTTPException(status_code=400, detail="Esta propiedad ya salió de la cartera")

        existing = (
            self.db.query(PropertySale)
            .filter(PropertySale.property_id == property_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Esta propiedad ya tiene una venta registrada",
            )

        if not data.installments:
            raise HTTPException(status_code=400, detail="Indicá al menos una cuota o el pago de contado")

        total = _round2(data.total_amount)
        inst_sum = _round2(sum(i.amount for i in data.installments))
        if abs(total - inst_sum) > 0.05:
            raise HTTPException(
                status_code=400,
                detail=f"Las cuotas suman ${inst_sum:,.2f} y el total es ${total:,.2f}",
            )

        currency = normalize_currency(data.currency)
        if currency not in ("PESOS", "DOLARES"):
            raise HTTPException(status_code=400, detail="La venta es en pesos o en dólares, no se mezclan")

        buyer_owner = None
        buyer_name = (data.buyer_name or "").strip() or None
        if data.keep_managing:
            if not data.buyer_owner_id:
                raise HTTPException(
                    status_code=400,
                    detail="Si seguís administrando, el comprador tiene que ser un dueño de Personas",
                )
            buyer_owner = (
                self.db.query(Owner)
                .filter(Owner.id == data.buyer_owner_id, Owner.status == 1)
                .first()
            )
            if not buyer_owner:
                raise HTTPException(status_code=404, detail="El dueño comprador no existe")
            buyer_name = buyer_owner.name
        else:
            if not buyer_name:
                raise HTTPException(
                    status_code=400,
                    detail="Si no seguís administrando, indicá el nombre del comprador",
                )

        sale = PropertySale(
            property_id=prop.id,
            seller_owner_id=prop.owner_id,
            buyer_owner_id=buyer_owner.id if buyer_owner else None,
            buyer_name=buyer_name,
            sale_date=data.sale_date,
            currency=currency,
            total_amount=total,
            keep_managing=bool(data.keep_managing),
            status="PENDIENTE",
            notes=data.notes,
        )
        self.db.add(sale)
        self.db.flush()

        method = (data.payment_method or "transferencia").strip().lower() or "transferencia"
        receiver = normalize_received_by(data.received_by)

        for row in data.installments:
            kind = _normalize_kind(getattr(row, "kind", None))
            inst = PropertySalePayment(
                sale_id=sale.id,
                due_date=row.due_date,
                amount=_round2(row.amount),
                amount_paid=0.0,
                kind=kind,
                notes="Adelanto pactado" if kind == "adelanto" else None,
            )
            self.db.add(inst)
            self.db.flush()
            if row.paid:
                inst.amount_paid = inst.amount
                inst.paid_at = data.sale_date
                inst.method = method
                inst.received_by = receiver
                self._record_history(
                    sale, inst, inst.amount, data.sale_date, method, receiver, data.notes
                )

        self.db.flush()
        self.db.refresh(sale)
        self._refresh_sale_status(sale)

        if data.keep_managing:
            prop.owner_id = buyer_owner.id
            for garage in prop.garages or []:
                garage.owner_id = buyer_owner.id
            has_lease = bool(prop.rental_contract and prop.rental_contract.status == 1)
            prop.management_status = "ACTIVE" if has_lease else "DELIVERED"
        else:
            contract = prop.rental_contract
            if contract and contract.status == 1:
                from services.rental_contract_service import RentalContractService

                RentalContractService(self.db).cancel_contract(
                    contract.id,
                    cancelled_by="PROPIETARIO",
                    reason="Venta de propiedad",
                    effective_date=data.sale_date,
                    settlement_amount=0.0,
                    settlement_direction="SIN_MONTO",
                    waive_remaining_rent=True,
                    commit=False,
                )
            prop.management_status = "SOLD_OUT"
            for garage in prop.garages or []:
                garage.status = 0

        try:
            self.db.commit()
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No se pudo registrar la venta: {e}",
            )
        return self._to_response(self._load_sale(sale.id))

    def _unpaid_installment_filter(self):
        return PropertySalePayment.amount_paid < PropertySalePayment.amount

    def collection_summary(self) -> dict:
        unpaid = self.db.query(PropertySalePayment).filter(self._unpaid_installment_filter())
        pending_installments = unpaid.count()
        overdue_installments = unpaid.filter(PropertySalePayment.due_date < date.today()).count()
        pending_sales = (
            self.db.query(PropertySale)
            .filter(func.upper(PropertySale.status) != "PAGADA")
            .count()
        )
        return {
            "pending_sales": pending_sales,
            "pending_installments": pending_installments,
            "overdue_installments": overdue_installments,
        }

    def list_sales(
        self,
        page: int = 1,
        page_size: int = 20,
        q: Optional[str] = None,
        sale_status: Optional[str] = None,
        keep_managing: Optional[str] = None,
        month: Optional[str] = None,
        collect: Optional[str] = None,
    ) -> PaginatedSalesResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        query = self.db.query(PropertySale)

        if q and q.strip():
            term = f"%{q.strip().lower()}%"
            matching_properties = self.db.query(Property.id).filter(
                or_(
                    func.lower(func.coalesce(Property.direction, "")).like(term),
                    func.lower(func.coalesce(Property.floor, "")).like(term),
                    func.lower(func.coalesce(Property.apartment, "")).like(term),
                )
            )
            query = query.filter(
                or_(
                    func.lower(func.coalesce(PropertySale.buyer_name, "")).like(term),
                    PropertySale.property_id.in_(matching_properties),
                )
            )

        if sale_status and sale_status.strip():
            query = query.filter(func.upper(PropertySale.status) == sale_status.strip().upper())

        managing = (keep_managing or "").strip().lower()
        if managing in ("yes", "true", "1"):
            query = query.filter(PropertySale.keep_managing.is_(True))
        elif managing in ("no", "false", "0"):
            query = query.filter(PropertySale.keep_managing.is_(False))

        if month and month.strip():
            year_s, month_s = month.strip().split("-", 1)
            year_n, month_n = int(year_s), int(month_s)
            due_in_month = (
                self.db.query(PropertySalePayment.sale_id)
                .filter(
                    extract("year", PropertySalePayment.due_date) == year_n,
                    extract("month", PropertySalePayment.due_date) == month_n,
                )
            )
            query = query.filter(
                or_(
                    and_(
                        extract("year", PropertySale.sale_date) == year_n,
                        extract("month", PropertySale.sale_date) == month_n,
                    ),
                    PropertySale.id.in_(due_in_month),
                )
            )

        collect_key = (collect or "").strip().lower()
        if collect_key == "pending":
            query = query.filter(func.upper(PropertySale.status) != "PAGADA")
        elif collect_key == "overdue":
            overdue_ids = (
                self.db.query(PropertySalePayment.sale_id)
                .filter(
                    self._unpaid_installment_filter(),
                    PropertySalePayment.due_date < date.today(),
                )
                .distinct()
            )
            query = query.filter(PropertySale.id.in_(overdue_ids))

        total = query.count()
        items = (
            query.options(
                joinedload(PropertySale.property),
                joinedload(PropertySale.seller),
                joinedload(PropertySale.buyer),
                joinedload(PropertySale.installments),
            )
            .order_by(PropertySale.sale_date.desc(), PropertySale.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        for sale in items:
            self._sync_sale_history(sale)
        if items:
            self.db.commit()
        pages = ceil(total / page_size) if page_size and total else 0
        summary = self.collection_summary()
        return PaginatedSalesResponse(
            items=[self._to_response(s) for s in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
            pending_sales=summary["pending_sales"],
            pending_installments=summary["pending_installments"],
            overdue_installments=summary["overdue_installments"],
        )

    def get_sale(self, sale_id: int) -> PropertySaleResponse:
        return self._to_response(self._load_sale(sale_id))

    def _credit_installment(
        self,
        sale: PropertySale,
        inst: PropertySalePayment,
        amount: float,
        paid_at: date,
        method: str,
        receiver: str,
        notes: Optional[str],
    ) -> None:
        inst.amount_paid = _round2((inst.amount_paid or 0) + amount)
        if inst.amount_paid + 0.009 >= (inst.amount or 0):
            inst.paid_at = paid_at
        inst.method = method
        inst.received_by = receiver
        if notes:
            inst.notes = notes
        self._record_history(sale, inst, amount, paid_at, method, receiver, notes)

    def collect_installment(
        self, sale_id: int, installment_id: int, data: CollectSalePaymentDTO
    ) -> PropertySaleResponse:
        sale = self._load_sale(sale_id)
        inst = next((i for i in sale.installments if i.id == installment_id), None)
        if not inst:
            raise HTTPException(status_code=404, detail="Cuota no encontrada")
        remaining = _installment_remaining(inst)
        if remaining <= 0.009:
            raise HTTPException(status_code=400, detail="Esa cuota ya está cobrada")
        amount = _round2(data.amount if data.amount is not None else remaining)
        extra = _round2(amount - remaining)
        reason = (data.overpay_reason or "").strip().lower() or None
        extra_note = (data.overpay_note or "").strip()
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
        paid_at = data.paid_at or date.today()
        method = (data.method or "transferencia").strip().lower() or "transferencia"
        receiver = normalize_received_by(data.received_by)

        if extra > 0.009 and reason == "adelanto":
            later = [
                other
                for other in sorted(sale.installments, key=_installment_sort_key)
                if other.id != inst.id and _installment_remaining(other) > 0.009
            ]
            later_remaining = _round2(sum(_installment_remaining(other) for other in later))
            if not later or extra > later_remaining + 0.009:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No hay cuotas siguientes con saldo suficiente para el adelanto. "
                        "Elegí Otro o Cancelar."
                    ),
                )
            current_note = (
                data.notes
                or f"Pago de la cuota. Incluye adelanto de ${extra:,.2f} a las siguientes."
            )
            if remaining > 0.009:
                self._credit_installment(
                    sale, inst, remaining, paid_at, method, receiver, current_note
                )
            leftover = extra
            source = inst.due_date.isoformat()
            for nxt in later:
                if leftover <= 0.009:
                    break
                take = min(leftover, _installment_remaining(nxt))
                self._credit_installment(
                    sale,
                    nxt,
                    take,
                    paid_at,
                    method,
                    receiver,
                    f"Adelanto. Sobra de la cuota vto {source}.",
                )
                leftover = _round2(leftover - take)
        else:
            note = data.notes
            if extra > 0.009 and reason == "otro":
                note = f"Pago de más (${extra:,.2f}): {extra_note}"
                if data.notes:
                    note = f"{data.notes}. {note}"
            self._credit_installment(sale, inst, amount, paid_at, method, receiver, note)

        self._refresh_sale_status(sale)
        self.db.commit()
        return self._to_response(self._load_sale(sale.id))
