from collections import defaultdict
from datetime import date
from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from models.contract import RentalContract
from models.contract_history import ContractHistory
from models.contract_period import ContractPeriod
from models.contract_termination import ContractTermination, SettlementDirectionEnum
from models.property import Garage, Property
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
from utils.contract_display import garage_display_label, iter_months, property_display_label


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


class _Unit:
    def __init__(self, unit_type: str, obj):
        self.type = unit_type
        self.obj = obj
        self.id = obj.id
        self.key = f"{'p' if unit_type == 'property' else 'g'}-{obj.id}"

    @property
    def management_status(self) -> str:
        return (self.obj.management_status or "").upper()

    def fields(self) -> dict:
        if self.type == "property":
            prop = self.obj
            return {
                "unit_key": self.key,
                "unit_type": "property",
                "property_id": prop.id,
                "garage_id": None,
                "unit_label": property_display_label(prop),
                "direction": prop.direction or "Sin dirección",
                "floor": prop.floor,
                "apartment": prop.apartment,
            }
        label = garage_display_label(self.obj)
        return {
            "unit_key": self.key,
            "unit_type": "garage",
            "property_id": None,
            "garage_id": self.obj.id,
            "unit_label": label,
            "direction": label,
            "floor": None,
            "apartment": None,
        }


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
        if not property_ids:
            return {}
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

    def _property_lease_ids(self, contract_ids) -> set[int]:
        """Contracts whose history says they were a property lease, not garage-only."""
        rows = (
            self.db.query(ContractHistory.rental_contract_id, ContractHistory.property_address)
            .filter(ContractHistory.rental_contract_id.in_(contract_ids))
            .all()
        )
        return {
            int(contract_id)
            for contract_id, address in rows
            if contract_id and not _is_garage_only_history(address)
        }

    def _contract_scope(self, property_ids: list[int], garage_ids: list[int]):
        history_map = self._history_property_ids(property_ids)
        filters = []
        if property_ids:
            filters.append(RentalContract.property_id.in_(property_ids))
        if history_map:
            filters.append(RentalContract.id.in_(list(history_map.keys())))
        if garage_ids:
            filters.append(
                and_(
                    RentalContract.garage_id.in_(garage_ids),
                    RentalContract.property_id.is_(None),
                )
            )
        return history_map, or_(*filters)

    def _line_unit(self, contract, units: dict, history_map: dict[int, int], property_leases: set[int]):
        if not contract:
            return None
        if contract.property_id and f"p-{contract.property_id}" in units:
            return units[f"p-{contract.property_id}"]
        mapped = history_map.get(contract.id)
        if mapped and f"p-{mapped}" in units:
            return units[f"p-{mapped}"]
        if (
            contract.property_id is None
            and contract.garage_id
            and contract.id not in property_leases
        ):
            return units.get(f"g-{contract.garage_id}")
        return None

    def _sale_income(self, units: dict, property_ids, garage_ids, start_date: date, end_date: date):
        """Installments due inside the range, billed/collected like rent periods."""
        filters = []
        if property_ids:
            filters.append(PropertySale.property_id.in_(property_ids))
        if garage_ids:
            filters.append(PropertySale.garage_id.in_(garage_ids))
        sales = (
            self.db.query(PropertySale)
            .options(joinedload(PropertySale.installments), joinedload(PropertySale.buyer))
            .filter(or_(*filters))
            .all()
        )
        billed = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        collected = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        lines = []
        sold_on = {}
        for sale in sales:
            key = f"g-{sale.garage_id}" if sale.garage_id else f"p-{sale.property_id}"
            unit = units.get(key)
            if unit is None:
                continue
            if unit.management_status == "SOLD_OUT":
                sold_on[key] = sale.sale_date
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
                billed[key][currency_key] += amount
                collected[key][currency_key] += paid
                lines.append(
                    SaleLine(
                        **unit.fields(),
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
        order = {key: idx for idx, key in enumerate(units)}
        lines.sort(key=lambda line: (order.get(line.unit_key, 0), line.due_date))
        return billed, collected, lines, sold_on

    def _load_units(self, property_ids: list[int], garage_ids: list[int]) -> dict:
        units = {}
        if property_ids:
            properties = (
                self.db.query(Property)
                .filter(Property.id.in_(property_ids), Property.status == 1)
                .all()
            )
            found = {p.id: p for p in properties}
            missing = [pid for pid in property_ids if pid not in found]
            if missing:
                raise HTTPException(
                    status_code=404,
                    detail=f"No se encontraron las propiedades: {', '.join(map(str, missing))}",
                )
            for pid in property_ids:
                unit = _Unit("property", found[pid])
                units[unit.key] = unit
        if garage_ids:
            garages = (
                self.db.query(Garage)
                .options(joinedload(Garage.property))
                .filter(Garage.id.in_(garage_ids), Garage.status == 1)
                .all()
            )
            found = {g.id: g for g in garages}
            missing = [gid for gid in garage_ids if gid not in found]
            if missing:
                raise HTTPException(
                    status_code=404,
                    detail=f"No se encontraron las cocheras: {', '.join(map(str, missing))}",
                )
            for gid in garage_ids:
                unit = _Unit("garage", found[gid])
                units[unit.key] = unit
        return units

    def property_income(
        self,
        property_ids: list[int],
        start_date: date,
        end_date: date,
        garage_ids: list[int] | None = None,
    ) -> PropertyIncomeReport:
        if start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="La fecha desde no puede ser posterior a la fecha hasta.",
            )
        pids = sorted({int(pid) for pid in property_ids or [] if pid})
        gids = sorted({int(gid) for gid in garage_ids or [] if gid})
        if not pids and not gids:
            raise HTTPException(
                status_code=400,
                detail="Seleccioná al menos una propiedad o cochera.",
            )

        units = self._load_units(pids, gids)
        billed = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        collected = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        period_lines = defaultdict(list)
        history_map, contract_scope = self._contract_scope(pids, gids)

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
        property_leases = (
            self._property_lease_ids({p.contract_id for p in billed_rows}) if gids else set()
        )
        for period in billed_rows:
            contract = period.contract
            waived = False
            if _status_value(period.payment_status) == PaymentStatusEnum.CONTRATO_TERMINADO.value:
                if float(period.amount_paid or 0) <= 0:
                    # Annulled while the tenant still occupied it (early leave):
                    # shown as "sin cobrar" so the month does not look vacant.
                    left_on = getattr(contract, "end_date", None)
                    if not left_on or period.start_date > left_on:
                        continue
                    waived = True
            unit = self._line_unit(contract, units, history_map, property_leases)
            if unit is None:
                continue
            currency_key = normalize_currency(getattr(contract, "currency", None))
            amount = 0.0 if waived else float(period.total_amount or 0)
            paid = 0.0 if waived else float(period.amount_paid or 0)
            tenant = getattr(contract, "tenant", None)
            billed[unit.key][currency_key] += amount
            collected[unit.key][currency_key] += paid
            period_lines[unit.key].append(
                BilledLine(
                    **unit.fields(),
                    tenant_name=tenant.name if tenant else None,
                    period_start=period.start_date,
                    period_end=period.end_date,
                    currency=currency_key,
                    amount=amount,
                    amount_paid=paid,
                    payment_status=_status_value(period.payment_status),
                    kind="waived" if waived else "period",
                    note=(
                        "Sin cobrar por baja anticipada"
                        if waived
                        else period.proration_note or period.termination_note
                    ),
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
        if gids:
            property_leases |= self._property_lease_ids(
                {term.rental_contract_id for term in settlements}
            )
        settlement_lines = defaultdict(list)
        for term in settlements:
            contract = term.contract
            unit = self._line_unit(contract, units, history_map, property_leases)
            if unit is None:
                continue
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
            billed[unit.key][currency_key] += billed_amount
            collected[unit.key][currency_key] += collected_amount
            settlement_lines[unit.key].append(
                BilledLine(
                    **unit.fields(),
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
            units, pids, gids, start_date, end_date
        )

        billed_lines = []
        for key, unit in units.items():
            existing = period_lines[key]
            sale_date = sold_on.get(key)
            unit_lines = []
            for month_from, month_to in iter_months(start_date, end_date):
                covers = [
                    line
                    for line in existing
                    if line.period_start <= month_to and line.period_end >= month_from
                ]
                if covers:
                    unit_lines.extend(
                        line
                        for line in covers
                        if not any(
                            prev.period_start == line.period_start
                            and prev.period_end == line.period_end
                            and prev.kind == line.kind
                            and prev.tenant_name == line.tenant_name
                            for prev in unit_lines
                        )
                    )
                else:
                    sold = sale_date is not None and month_to >= sale_date
                    unit_lines.append(
                        BilledLine(
                            **unit.fields(),
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
            billed_lines.extend(unit_lines)
            billed_lines.extend(settlement_lines[key])

        items = []
        totals = PropertyIncomeTotals()
        for key, unit in units.items():
            item = PropertyIncomeItem(
                **unit.fields(),
                billed_pesos=billed[key]["PESOS"],
                billed_dolares=billed[key]["DOLARES"],
                collected_pesos=collected[key]["PESOS"],
                collected_dolares=collected[key]["DOLARES"],
                sale_billed_pesos=sale_billed[key]["PESOS"],
                sale_billed_dolares=sale_billed[key]["DOLARES"],
                sale_collected_pesos=sale_collected[key]["PESOS"],
                sale_collected_dolares=sale_collected[key]["DOLARES"],
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
