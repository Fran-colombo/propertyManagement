from pydantic import BaseModel
from datetime import date
from typing import Optional

class PropertyMiniDTO(BaseModel):
    id: int
    direction: str


    class Config:
        orm_mode = True

class TenantMiniDTO(BaseModel):
    id: int
    name: str


    class Config:
        orm_mode = True

class AllContractResponse(BaseModel):
    id: int
    property_id: int
    tenant_id: int
    start_date: date
    end_date: date
    cancelled: int
    property: Optional[PropertyMiniDTO]
    tenant: Optional[TenantMiniDTO]

    class Config:
        orm_mode = True
