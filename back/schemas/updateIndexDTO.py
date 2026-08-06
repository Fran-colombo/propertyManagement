from pydantic import BaseModel, Field

from schemas.enums.enums import IndexTypeEnum

class CreateIndex(BaseModel):
    type: IndexTypeEnum
    value: float


class UpdateIndexDTO(BaseModel):
    type: IndexTypeEnum
    value: float


class ApplyIndexDTO(BaseModel):
    value: float = Field(..., description="Porcentaje de variación a aplicar")
