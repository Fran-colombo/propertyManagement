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


class PropertyIncomeTotals(BaseModel):
    billed_pesos: float = 0
    billed_dolares: float = 0
    collected_pesos: float = 0
    collected_dolares: float = 0


class PropertyIncomeReport(BaseModel):
    start_date: date
    end_date: date
    items: List[PropertyIncomeItem]
    totals: PropertyIncomeTotals
