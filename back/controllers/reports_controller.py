from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas.reportDTO import PropertyIncomeReport
from services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


def get_service(db: Session = Depends(get_db)):
    return ReportService(db)


@router.get("/property-income", response_model=PropertyIncomeReport)
def property_income(
    property_ids: str = Query(..., description="IDs de propiedades separados por coma"),
    start_date: date = Query(...),
    end_date: date = Query(...),
    service: ReportService = Depends(get_service),
):
    ids = []
    for raw in (property_ids or "").split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            ids.append(int(raw))
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"ID de propiedad inválido: {raw}",
            )
    return service.property_income(ids, start_date, end_date)
