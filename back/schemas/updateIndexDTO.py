from pydantic import BaseModel, Field
from typing import Optional

from schemas.enums.enums import IndexTypeEnum

class CreateIndex(BaseModel):
    type: IndexTypeEnum
    value: float


class UpdateIndexDTO(BaseModel):
    type: IndexTypeEnum
    value: float


class ApplyIndexDTO(BaseModel):
    value: Optional[float] = Field(
        None, description="Porcentaje de variación a aplicar"
    )
    new_index_value: Optional[float] = Field(
        None, description="Valor del índice nuevo (IPC); si viene, se usa para calcular el %"
    )
