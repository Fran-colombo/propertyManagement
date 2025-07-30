from pydantic import BaseModel
from typing import Optional

class GarageCreate(BaseModel):
    number: str
    owner_id: int
    property_id: Optional[int] = None

class GarageRead(GarageCreate):
    id: int

    class Config:
        orm_mode = True
