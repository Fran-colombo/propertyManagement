# from typing import Optional
# from pydantic import BaseModel
# from schemas.contractDTO import ContractResponse

# class CreateGarage(BaseModel):
#     number: str
#     owner_id: int
#     rental_contract: Optional['ContractResponse'] = None
# class GarageResponse(BaseModel):
#     id: int

    
#     class Config:
#         orm_mode = True


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
