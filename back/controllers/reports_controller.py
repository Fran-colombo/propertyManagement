from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas.reportDTO import PropertyIncomeReport
from services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


def get_service(db: Session = Depends(get_db)):
    return ReportService(db)


def _parse_ids(raw_ids: str, what: str) -> list[int]:
    ids = []
    for raw in (raw_ids or "").split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            ids.append(int(raw))
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"ID de {what} inválido: {raw}",
            )
    return ids


@router.get("/property-income", response_model=PropertyIncomeReport)
def property_income(
    property_ids: str = Query("", description="IDs de propiedades separados por coma"),
    garage_ids: str = Query("", description="IDs de cocheras separados por coma"),
    start_date: date = Query(...),
    end_date: date = Query(...),
    service: ReportService = Depends(get_service),
):
    return service.property_income(
        _parse_ids(property_ids, "propiedad"),
        start_date,
        end_date,
        garage_ids=_parse_ids(garage_ids, "cochera"),
    )
