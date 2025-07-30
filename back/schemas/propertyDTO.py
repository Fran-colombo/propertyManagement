from datetime import date
from pydantic import BaseModel, validator
from typing import  List, Optional

from schemas.contract_periodDTO import ContractPeriodResponse



class OwnerSimpleResponse(BaseModel):
    id: int
    name: str
    email: str


class RealAgencySimpleResponse(BaseModel):
    id: int
    name: str


class TenantSimpleResponse(BaseModel):
    id: int
    name: str


class RentalContractSimpleResponse(BaseModel):
    id: int
    tenant: TenantSimpleResponse


class GarageResponse(BaseModel):
    id: int
    number: str
    rental_contract_id: Optional[int] = None


class CreatePropertyDTO(BaseModel):
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None
    real_agency_id: Optional[int] = None
    owner_id: int

    @validator('owner_id')
    def owner_id_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("El ID del dueño debe ser positivo")
        return v


class PropertyCreateResponse(BaseModel):
    id: int
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None
    owner: OwnerSimpleResponse
    rental_contract: Optional[RentalContractSimpleResponse] = None
    garages: List[GarageResponse] = []

    class Config:
        from_attributes = True

class RentalContractWithPeriodsResponse(BaseModel):
    id: int
    tenant: TenantSimpleResponse
    periods: List[ContractPeriodResponse]
    start_date: date
    end_date: date


    class Config:
        from_attributes = True

class PropertyResponse(BaseModel):
    id: int
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None
    owner: OwnerSimpleResponse
    rental_contract: Optional[RentalContractWithPeriodsResponse] = None  # ← CAMBIO
    garages: List[GarageResponse] = []

    class Config:
        from_attributes = True

class PropertySimpleResponse(BaseModel):
    id: int
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None

class PropertyDeleteResponse(BaseModel):
    message: str
    property_id: int
    deleted_at: date


    class Config:
        from_attributes = True
