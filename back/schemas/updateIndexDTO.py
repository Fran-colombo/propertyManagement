from pydantic import BaseModel

from schemas.enums.enums import IndexTypeEnum

class CreateIndex(BaseModel):
    type: IndexTypeEnum
    value: float


class UpdateIndexDTO(BaseModel):
    type: IndexTypeEnum
    value: float