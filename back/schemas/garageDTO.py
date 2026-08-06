from pydantic import BaseModel, ConfigDict
from typing import Optional

class GarageCreate(BaseModel):
    number: str
    owner_id: int
    property_id: Optional[int] = None

class GarageRead(GarageCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
