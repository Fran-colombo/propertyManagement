from typing import Optional
from pydantic import BaseModel, ConfigDict

class RealAgencyCreate(BaseModel):
    name: str
    direction: str

class RealAgencyRead(RealAgencyCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

class UpdateRealAgency(BaseModel):
    name: Optional[str] = None
    direction: Optional[str] = None
