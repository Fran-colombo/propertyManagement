from typing import Optional
from pydantic import BaseModel

class RealAgencyCreate(BaseModel):
    name: str
    direction: str

class RealAgencyRead(RealAgencyCreate):
    id: int

    class Config:
        from_attributes = True  

class UpdateRealAgency(BaseModel):
    name: Optional[str] = None
    direction: Optional[str] = None