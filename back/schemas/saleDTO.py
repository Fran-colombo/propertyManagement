from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field
from schemas.enums.enums import CurrencyEnum


class SaleInstallmentInput(BaseModel):
    due_date: date
    amount: float = Field(..., gt=0)
    paid: bool = False
    kind: Optional[str] = "cuota"


class SellPropertyDTO(BaseModel):
    keep_managing: bool = True
    buyer_owner_id: Optional[int] = None
    buyer_name: Optional[str] = None
    sale_date: date
    currency: CurrencyEnum
    total_amount: float = Field(..., gt=0)
    notes: Optional[str] = None
    installments: List[SaleInstallmentInput]
    payment_method: str = "transferencia"
    received_by: Optional[str] = "DUENO"


class CollectSalePaymentDTO(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    method: str = "transferencia"
    received_by: Optional[str] = "DUENO"
    notes: Optional[str] = None
    paid_at: Optional[date] = None
    overpay_reason: Optional[str] = None
    overpay_note: Optional[str] = None


class SaleInstallmentResponse(BaseModel):
    id: int
    due_date: date
    amount: float
    amount_paid: float
    remaining: float
    paid_at: Optional[date] = None
    method: Optional[str] = None
    received_by: Optional[str] = None
    notes: Optional[str] = None
    kind: str = "cuota"


class PropertySaleResponse(BaseModel):
    id: int
    property_id: int
    property_direction: str
    property_address: Optional[str] = None
    property_floor: Optional[str] = None
    property_apartment: Optional[str] = None
    seller_owner_id: Optional[int] = None
    seller_name: Optional[str] = None
    buyer_owner_id: Optional[int] = None
    buyer_name: Optional[str] = None
    sale_date: date
    currency: str
    total_amount: float
    amount_paid: float
    remaining: float
    keep_managing: bool
    status: str
    notes: Optional[str] = None
    installments: List[SaleInstallmentResponse] = []


class PaginatedSalesResponse(BaseModel):
    items: List[PropertySaleResponse]
    total: int
    page: int
    page_size: int
    pages: int
    pending_sales: int = 0
    pending_installments: int = 0
    overdue_installments: int = 0


class SalesCollectionSummary(BaseModel):
    pending_sales: int
    pending_installments: int
    overdue_installments: int
