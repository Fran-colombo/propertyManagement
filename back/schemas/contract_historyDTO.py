from pydantic import BaseModel
from datetime import date
from typing import Optional

class PropertyMiniDTO(BaseModel):
    id: int
    direction: str

    class Config:
        from_attributes = True

class TenantMiniDTO(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class AllContractResponse(BaseModel):
    id: int
    rental_contract_id: Optional[int] = None
    property_id: Optional[int] = None
    tenant_id: int
    start_date: date
    end_date: date
    cancelled: int
    cancellation_reason: Optional[str] = None
    cancelled_by: Optional[str] = None
    settlement_amount: Optional[float] = None
    settlement_direction: Optional[str] = None
    receipt_path: Optional[str] = None
    property_address: Optional[str] = None
    property: Optional[PropertyMiniDTO] = None
    tenant: Optional[TenantMiniDTO] = None

    class Config:
        from_attributes = True
