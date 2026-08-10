from pydantic import BaseModel, ConfigDict
from typing import Optional


class GarageCreate(BaseModel):
    number: str
    owner_id: int
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
