from fastapi import APIRouter, Depends, Query
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
    service: PropertySaleService = Depends(get_service),
):
    return service.list_sales(page=page, page_size=page_size)


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
