from datetime import date
from pydantic import BaseModel, ConfigDict
from typing import Optional


class GarageCreate(BaseModel):
    number: str
    owner_id: int
    property_id: Optional[int] = None


class GarageUpdate(BaseModel):
    number: Optional[str] = None
    owner_id: Optional[int] = None
    property_id: Optional[int] = None


class GarageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    owner_id: int
    property_id: Optional[int] = None
    owner_name: Optional[str] = None
    property_direction: Optional[str] = None
    rental_contract_id: Optional[int] = None
    tenant_name: Optional[str] = None
    management_status: str = "ACTIVE"
    label: Optional[str] = None
    contract_end_date: Optional[date] = None
    contract_document_path: Optional[str] = None
    # Set when the garage is rented as part of a property lease
    contract_property_id: Optional[int] = None
