from typing import Optional
from pydantic import BaseModel

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
        from_attributes = True  