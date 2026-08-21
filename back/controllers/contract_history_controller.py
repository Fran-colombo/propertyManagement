from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from services.contract_history_service import AllContractService
from schemas.contract_historyDTO import AllContractResponse, PaginatedContractHistoryResponse

router = APIRouter(prefix="/contracts-history", tags=["All Contracts"])


@router.get("/", response_model=PaginatedContractHistoryResponse)
def get_all_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    property_id: Optional[int] = Query(None),
    month: Optional[str] = Query(None, description="YYYY-MM, filtra por fecha de inicio"),
    tenant: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if month:
        parts = month.split("-")
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            raise HTTPException(status_code=400, detail="El mes debe ser YYYY-MM")
        month_num = int(parts[1])
        if month_num < 1 or month_num > 12:
            raise HTTPException(status_code=400, detail="Mes inválido")
    service = AllContractService(db)
    return service.get_paginated(
        page=page,
        page_size=page_size,
        property_id=property_id,
        month=month or None,
        tenant=tenant or None,
    )


@router.get("/{property_id}", response_model=list[AllContractResponse])
def get_contracts(property_id: int, db: Session = Depends(get_db)):
    service = AllContractService(db)
    return service.get_all_by_property_id(property_id)
