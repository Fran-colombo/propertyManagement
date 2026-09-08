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
from schemas.enums.enums import PaymentStatusEnum
from schemas.reportDTO import BilledLine, PropertyIncomeItem, PropertyIncomeReport, PropertyIncomeTotals
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

        billed_lines = []
        for pid in ids:
            prop = found[pid]
            existing = period_lines[pid]
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
                            kind="vacant",
                            note="No factura: no está ocupado",
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
            items.append(
                PropertyIncomeItem(
                    property_id=pid,
                    direction=prop.direction,
                    floor=prop.floor,
                    apartment=prop.apartment,
                    billed_pesos=billed_pesos,
                    billed_dolares=billed_dolares,
                    collected_pesos=collected_pesos,
                    collected_dolares=collected_dolares,
                )
            )
            totals.billed_pesos += billed_pesos
            totals.billed_dolares += billed_dolares
            totals.collected_pesos += collected_pesos
            totals.collected_dolares += collected_dolares

        return PropertyIncomeReport(
            start_date=start_date,
            end_date=end_date,
            items=items,
            totals=totals,
            billed_lines=billed_lines,
        )
