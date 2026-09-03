from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas.saleDTO import CollectSalePaymentDTO, PaginatedSalesResponse, PropertySaleResponse, SellPropertyDTO
from services.property_sale_service import PropertySaleService

router = APIRouter(prefix="/sales", tags=["Property Sales"])


def get_service(db: Session = Depends(get_db)):
    return PropertySaleService(db)


@router.get("/", response_model=PaginatedSalesResponse)
def list_sales(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="PAGADA | PARCIAL | PENDIENTE"),
    keep_managing: Optional[str] = Query(None, description="yes | no"),
    month: Optional[str] = Query(None, description="YYYY-MM, vacío lista todas"),
    service: PropertySaleService = Depends(get_service),
):
    if month:
        parts = month.split("-")
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            raise HTTPException(status_code=400, detail="El mes debe ser YYYY-MM")
        month_num = int(parts[1])
        if month_num < 1 or month_num > 12:
            raise HTTPException(status_code=400, detail="Mes inválido")
    if status and status.strip().upper() not in ("PAGADA", "PARCIAL", "PENDIENTE"):
        raise HTTPException(status_code=400, detail="Estado inválido")
    return service.list_sales(
        page=page,
        page_size=page_size,
        q=q,
        sale_status=status,
        keep_managing=keep_managing,
        month=month or None,
    )


@router.get("/{sale_id}", response_model=PropertySaleResponse)
def get_sale(sale_id: int, service: PropertySaleService = Depends(get_service)):
    return service.get_sale(sale_id)


@router.post(
    "/{sale_id}/installments/{installment_id}/pay",
    response_model=PropertySaleResponse,
)
def collect_installment(
    sale_id: int,
    installment_id: int,
    data: CollectSalePaymentDTO,
    service: PropertySaleService = Depends(get_service),
):
    return service.collect_installment(sale_id, installment_id, data)
