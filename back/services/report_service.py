from collections import defaultdict
from datetime import date
from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from models.contract import RentalContract
from models.contract_history import ContractHistory
from models.contract_period import ContractPeriod
from models.contract_termination import ContractTermination, SettlementDirectionEnum
from models.property import Property
from models.property_sale import PropertySale
from schemas.enums.enums import PaymentStatusEnum
from schemas.reportDTO import (
    BilledLine,
    PropertyIncomeItem,
    PropertyIncomeReport,
    PropertyIncomeTotals,
    SaleLine,
)
from services.property_sale_service import _normalize_kind, _sale_payment_status
from services.transaction_service import normalize_currency
from utils.contract_display import iter_months


def _status_value(value) -> str:
    if hasattr(value, "value"):
        value = value.value
    return str(value or "").strip().upper()


def _direction_value(value) -> str:
    if hasattr(value, "value"):
        value = value.value
    return str(value or "").strip().upper()


def _is_garage_only_history(address) -> bool:
    return str(address or "").startswith("Garage N°")


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def _history_property_ids(self, property_ids: list[int]) -> dict[int, int]:
        """Map cancelled/previous contracts back to a property via historial.

        Creating a new lease used to null `rental_contracts.property_id` on the
        previous contract (one-to-one relationship). History keeps the link.
        Garage-only leases are excluded so their rent does not appear as
        occupancy of the building unit.
        """
        rows = (
            self.db.query(
                ContractHistory.rental_contract_id,
                ContractHistory.property_id,
                ContractHistory.property_address,
            )
            .filter(ContractHistory.property_id.in_(property_ids))
            .filter(ContractHistory.rental_contract_id.isnot(None))
            .order_by(ContractHistory.id.asc())
            .all()
        )
        mapping = {}
        for contract_id, property_id, address in rows:
            if not contract_id or not property_id:
                continue
            if _is_garage_only_history(address):
                continue
            mapping[int(contract_id)] = int(property_id)
        return mapping

    def _contract_property_scope(self, ids: list[int]):
        history_map = self._history_property_ids(ids)
        filters = [RentalContract.property_id.in_(ids)]
        if history_map:
            filters.append(RentalContract.id.in_(list(history_map.keys())))
        return history_map, or_(*filters)

    def _line_property_id(self, contract, found: dict, history_map: dict[int, int]):
        if not contract:
            return None
        if contract.property_id in found:
            return contract.property_id
        return history_map.get(contract.id)

    def _sale_income(self, found: dict, start_date: date, end_date: date):
        """Installments due inside the range, billed/collected like rent periods."""
        sales = (
            self.db.query(PropertySale)
            .options(joinedload(PropertySale.installments), joinedload(PropertySale.buyer))
            .filter(PropertySale.property_id.in_(list(found.keys())))
            .all()
        )
        billed = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        collected = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        lines = []
        sold_on = {}
        for sale in sales:
            pid = sale.property_id
            prop = found[pid]
            if (prop.management_status or "") == "SOLD_OUT":
                sold_on[pid] = sale.sale_date
            currency_key = normalize_currency(sale.currency)
            buyer = sale.buyer_name or (sale.buyer.name if sale.buyer else None)
            installments = sorted(
                sale.installments, key=lambda i: (i.due_date or date.max, i.id or 0)
            )
            cuotas = [i for i in installments if _normalize_kind(i.kind) != "adelanto"]
            for inst in installments:
                if not inst.due_date or not (start_date <= inst.due_date <= end_date):
                    continue
                amount = float(inst.amount or 0)
                paid = float(inst.amount_paid or 0)
                if _normalize_kind(inst.kind) == "adelanto":
                    label = "Adelanto"
                else:
                    label = f"Cuota {cuotas.index(inst) + 1}/{len(cuotas)}"
                billed[pid][currency_key] += amount
                collected[pid][currency_key] += paid
                lines.append(
                    SaleLine(
                        property_id=pid,
                        direction=prop.direction,
                        floor=prop.floor,
                        apartment=prop.apartment,
                        sale_id=sale.id,
                        buyer_name=buyer,
                        label=label,
                        due_date=inst.due_date,
                        paid_at=inst.paid_at if paid > 0 else None,
                        currency=currency_key,
                        amount=amount,
                        amount_paid=paid,
                        status=_sale_payment_status(amount, paid),
                    )
                )
        lines.sort(key=lambda line: (line.property_id, line.due_date))
        return billed, collected, lines, sold_on

    def property_income(
        self,
        property_ids: list[int],
        start_date: date,
        end_date: date,
    ) -> PropertyIncomeReport:
        if start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="La fecha desde no puede ser posterior a la fecha hasta.",
            )
        ids = sorted({int(pid) for pid in property_ids if pid})
        if not ids:
            raise HTTPException(
                status_code=400,
                detail="Seleccioná al menos una propiedad.",
            )

        properties = (
            self.db.query(Property)
            .filter(Property.id.in_(ids), Property.status == 1)
            .all()
        )
        found = {p.id: p for p in properties}
        missing = [pid for pid in ids if pid not in found]
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontraron las propiedades: {', '.join(map(str, missing))}",
            )

        billed = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        collected = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        period_lines = defaultdict(list)
        history_map, contract_scope = self._contract_property_scope(ids)

        billed_rows = (
            self.db.query(ContractPeriod)
            .options(
                joinedload(ContractPeriod.contract).joinedload(RentalContract.tenant),
            )
            .join(RentalContract, ContractPeriod.contract_id == RentalContract.id)
            .filter(contract_scope)
            .filter(ContractPeriod.start_date <= end_date)
            .filter(ContractPeriod.end_date >= start_date)
            .order_by(RentalContract.property_id, ContractPeriod.start_date)
            .all()
        )
        for period in billed_rows:
            if _status_value(period.payment_status) == PaymentStatusEnum.CONTRATO_TERMINADO.value:
                if float(period.amount_paid or 0) <= 0:
                    continue
            contract = period.contract
            property_id = self._line_property_id(contract, found, history_map)
            if property_id not in found:
                continue
            prop = found[property_id]
            currency_key = normalize_currency(getattr(contract, "currency", None))
            amount = float(period.total_amount or 0)
            paid = float(period.amount_paid or 0)
            tenant = getattr(contract, "tenant", None)
            billed[property_id][currency_key] += amount
            collected[property_id][currency_key] += paid
            period_lines[property_id].append(
                BilledLine(
                    property_id=property_id,
                    direction=prop.direction,
                    floor=prop.floor,
                    apartment=prop.apartment,
                    tenant_name=tenant.name if tenant else None,
                    period_start=period.start_date,
                    period_end=period.end_date,
                    currency=currency_key,
                    amount=amount,
                    amount_paid=paid,
                    payment_status=_status_value(period.payment_status),
                    kind="period",
                    note=period.proration_note or period.termination_note,
                )
            )

        settlements = (
            self.db.query(ContractTermination)
            .options(
                joinedload(ContractTermination.contract).joinedload(RentalContract.tenant),
            )
            .join(RentalContract, ContractTermination.rental_contract_id == RentalContract.id)
            .filter(contract_scope)
            .filter(ContractTermination.effective_date >= start_date)
            .filter(ContractTermination.effective_date <= end_date)
            .filter(ContractTermination.settlement_amount > 0)
            .all()
        )
        settlement_lines = defaultdict(list)
        for term in settlements:
            contract = term.contract
            property_id = self._line_property_id(contract, found, history_map)
            if property_id not in found:
                continue
            prop = found[property_id]
            currency_key = normalize_currency(getattr(contract, "currency", None))
            amount = float(term.settlement_amount or 0)
            direction = _direction_value(term.settlement_direction)
            tenant = getattr(contract, "tenant", None)
            if direction == SettlementDirectionEnum.PROPIETARIO_A_INQUILINO.value:
                billed_amount = 0.0
                collected_amount = -amount
                note = "Acuerdo de baja (Propietario → Inquilino)"
            else:
                billed_amount = amount
                collected_amount = amount
                note = "Acuerdo de baja (Inquilino → Propietario)"
            billed[property_id][currency_key] += billed_amount
            collected[property_id][currency_key] += collected_amount
            settlement_lines[property_id].append(
                BilledLine(
                    property_id=property_id,
                    direction=prop.direction,
                    floor=prop.floor,
                    apartment=prop.apartment,
                    tenant_name=tenant.name if tenant else None,
                    period_start=term.effective_date,
                    period_end=term.effective_date,
                    currency=currency_key,
                    amount=billed_amount,
                    amount_paid=collected_amount,
                    payment_status="BAJA",
                    kind="settlement",
                    note=note,
                )
            )

        sale_billed, sale_collected, sale_lines, sold_on = self._sale_income(
            found, start_date, end_date
        )

        billed_lines = []
        for pid in ids:
            prop = found[pid]
            existing = period_lines[pid]
            sale_date = sold_on.get(pid)
            for month_from, month_to in iter_months(start_date, end_date):
                covers = [
                    line
                    for line in existing
                    if line.period_start <= month_to and line.period_end >= month_from
                ]
                if covers:
                    billed_lines.extend(
                        line
                        for line in covers
                        if not any(
                            prev.period_start == line.period_start
                            and prev.period_end == line.period_end
                            and prev.kind == line.kind
                            and prev.tenant_name == line.tenant_name
                            for prev in billed_lines
                            if prev.property_id == pid
                        )
                    )
                else:
                    sold = sale_date is not None and month_to >= sale_date
                    billed_lines.append(
                        BilledLine(
                            property_id=pid,
                            direction=prop.direction,
                            floor=prop.floor,
                            apartment=prop.apartment,
                            tenant_name=None,
                            period_start=month_from,
                            period_end=month_to,
                            currency="PESOS",
                            amount=0,
                            amount_paid=0,
                            payment_status=None,
                            kind="sold" if sold else "vacant",
                            note=(
                                f"Vendida el {sale_date.strftime('%d/%m/%Y')}"
                                if sold
                                else "No factura: no está ocupado"
                            ),
                        )
                    )
            billed_lines.extend(settlement_lines[pid])

        items = []
        totals = PropertyIncomeTotals()
        for pid in ids:
            prop = found[pid]
            billed_pesos = billed[pid]["PESOS"]
            billed_dolares = billed[pid]["DOLARES"]
            collected_pesos = collected[pid]["PESOS"]
            collected_dolares = collected[pid]["DOLARES"]
            item = PropertyIncomeItem(
                property_id=pid,
                direction=prop.direction,
                floor=prop.floor,
                apartment=prop.apartment,
                billed_pesos=billed_pesos,
                billed_dolares=billed_dolares,
                collected_pesos=collected_pesos,
                collected_dolares=collected_dolares,
                sale_billed_pesos=sale_billed[pid]["PESOS"],
                sale_billed_dolares=sale_billed[pid]["DOLARES"],
                sale_collected_pesos=sale_collected[pid]["PESOS"],
                sale_collected_dolares=sale_collected[pid]["DOLARES"],
            )
            items.append(item)
            for field in PropertyIncomeTotals.model_fields:
                setattr(totals, field, getattr(totals, field) + getattr(item, field))

        return PropertyIncomeReport(
            start_date=start_date,
            end_date=end_date,
            items=items,
            totals=totals,
            billed_lines=billed_lines,
            sale_lines=sale_lines,
        )
