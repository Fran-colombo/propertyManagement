from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from schemas.garageDTO import GarageRead
from schemas.propertyDTO import PropertySimpleResponse

class CreateOwnerDTO(BaseModel):
    name: str
    phone: str
    email: str
    property_ids: Optional[List[int]] = None

class UpdateOwnerDTO(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    property_ids: Optional[List[int]] = None

class OwnerResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: str
    properties: List[PropertySimpleResponse] = []
    garages: List[GarageRead] = []
    
    model_config = ConfigDict(from_attributes=True)