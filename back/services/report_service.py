from collections import defaultdict
from datetime import date
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.contract import RentalContract
from models.contract_period import ContractPeriod
from models.property import Property
from models.transaction_history import TransactionHistory
from schemas.reportDTO import PropertyIncomeItem, PropertyIncomeReport, PropertyIncomeTotals
from services.transaction_service import normalize_currency


class ReportService:
    def __init__(self, db: Session):
        self.db = db

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
        billed_rows = (
            self.db.query(
                RentalContract.property_id,
                RentalContract.currency,
                ContractPeriod.total_amount,
            )
            .join(ContractPeriod, ContractPeriod.contract_id == RentalContract.id)
            .filter(RentalContract.property_id.in_(ids))
            .filter(ContractPeriod.start_date <= end_date)
            .filter(ContractPeriod.end_date >= start_date)
            .all()
        )
        for property_id, currency, total in billed_rows:
            billed[property_id][normalize_currency(currency)] += float(total or 0)

        collected = defaultdict(lambda: {"PESOS": 0.0, "DOLARES": 0.0})
        collected_rows = (
            self.db.query(
                RentalContract.property_id,
                TransactionHistory.currency,
                TransactionHistory.amount,
            )
            .join(RentalContract, RentalContract.id == TransactionHistory.contract_id)
            .filter(RentalContract.property_id.in_(ids))
            .filter(TransactionHistory.date >= start_date)
            .filter(TransactionHistory.date <= end_date)
            .filter(func.lower(func.coalesce(TransactionHistory.method, "")) != "carga_inicial")
            .filter(func.lower(func.coalesce(TransactionHistory.method, "")) != "venta")
            .all()
        )
        for property_id, currency, total in collected_rows:
            collected[property_id][normalize_currency(currency)] += float(total or 0)

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
        )
