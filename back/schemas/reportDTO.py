from datetime import date
from typing import List, Optional
from pydantic import BaseModel


class PropertyIncomeItem(BaseModel):
    property_id: int
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None
    billed_pesos: float = 0
    billed_dolares: float = 0
    collected_pesos: float = 0
    collected_dolares: float = 0
    sale_billed_pesos: float = 0
    sale_billed_dolares: float = 0
    sale_collected_pesos: float = 0
    sale_collected_dolares: float = 0


class SaleLine(BaseModel):
    property_id: int
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None
    sale_id: int
    buyer_name: Optional[str] = None
    label: str
    due_date: date
    paid_at: Optional[date] = None
    currency: str
    amount: float = 0
    amount_paid: float = 0
    status: str = "PENDIENTE"


class BilledLine(BaseModel):
    property_id: int
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None
    tenant_name: Optional[str] = None
    period_start: date
    period_end: date
    currency: str
    amount: float = 0
    amount_paid: float = 0
    payment_status: Optional[str] = None
    kind: str = "period"
    note: Optional[str] = None


class PropertyIncomeTotals(BaseModel):
    billed_pesos: float = 0
    billed_dolares: float = 0
    collected_pesos: float = 0
    collected_dolares: float = 0
    sale_billed_pesos: float = 0
    sale_billed_dolares: float = 0
    sale_collected_pesos: float = 0
    sale_collected_dolares: float = 0


class PropertyIncomeReport(BaseModel):
    start_date: date
    end_date: date
    items: List[PropertyIncomeItem]
    totals: PropertyIncomeTotals
    billed_lines: List[BilledLine] = []
    sale_lines: List[SaleLine] = []
