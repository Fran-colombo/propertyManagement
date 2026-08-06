from typing import Optional
from pydantic import BaseModel, ConfigDict

class CreateTenantDTO(BaseModel):
    name: str
    phone: str
    email: str


class UpdateTenantDTO(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class TenantResponse(CreateTenantDTO):
    model_config = ConfigDict(from_attributes=True)
    id: int
