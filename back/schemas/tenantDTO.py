# from typing import Optional
# from pydantic import BaseModel


# class CreateTenantDTO(BaseModel):
#     name: str
#     phone: str
#     email: str

# class UpdateTenantDTO(BaseModel):
#     name: Optional[str]
#     phone: Optional[str]
#     email: Optional[str]


# class TenantResponse(CreateTenantDTO):
#     id: int

#     class Config:
#         orm_mode = True

from typing import Optional, List
from pydantic import BaseModel
from schemas.propertyDTO import PropertySimpleResponse
from schemas.garageDTO import GarageRead

class CreateTenantDTO(BaseModel):
    name: str
    phone: str
    email: str


class UpdateTenantDTO(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class TenantResponse(CreateTenantDTO):
    id: int


    class Config:
        from_attributes = True  # Equivalente a orm_mode = True en Pydantic v2