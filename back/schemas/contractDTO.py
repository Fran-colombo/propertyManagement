from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date
from schemas.enums.enums import IndexTypeEnum, AdjustmentFrequencyEnum, CurrencyEnum
from typing import Optional, Dict

from schemas.propertyDTO import TenantSimpleResponse



class CreateContractDTO(BaseModel):
    property_id: Optional[int] = None
    tenant_id: int
    start_date: date
    end_date: date
    currency: CurrencyEnum
    base_rent: float = Field(..., gt=0)
    real_agency_id: Optional[int] = None
    index_type: Optional[IndexTypeEnum] = None
    frequency_adjustment: Optional[AdjustmentFrequencyEnum] = None
    includes_garage: bool = False
    garage_id: Optional[int] = None
    real_agency_id: Optional[int] = None
    fire_insurance: bool = False
    pays_api: bool = False
    pays_tgi: bool = False
    pays_epe: bool = False
    notes: Optional[str] = None

class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    property_id: Optional[int] = None
    tenant_id: int
    start_date: date
    end_date: date
    currency: str
    base_rent: float
    index_type: Optional[str] = None
    frequency_adjustment: Optional[str] = None
    includes_garage: bool
    garage_id: Optional[int] = None
    real_agency_id: Optional[int] = None
    fire_insurance: bool
    pays_api: bool
    pays_tgi: bool
    pays_epe: bool
    status: int
    notes: Optional[str] = None
    active_taxes: Optional[Dict[str, bool]] = None
    

    @classmethod
    def from_orm(cls, db_contract):
        # Extraer los valores del modelo SQLAlchemy
        contract_dict = {
            "id": db_contract.id,
            "property_id": db_contract.property_id,
            "tenant_id": db_contract.tenant_id,
            "start_date": db_contract.start_date,
            "end_date": db_contract.end_date,
            "currency": db_contract.currency.value,
            "base_rent": db_contract.base_rent,
            "index_type": db_contract.index_type,
            "frequency_adjustment": db_contract.frequency_adjustment,
            "real_agency_id": db_contract.real_agency_id,
            "includes_garage": db_contract.includes_garage,
            "garage_id": db_contract.garage_id,
            "status": db_contract.status,
            "fire_insurance": db_contract.fire_insurance,
            "pays_api": db_contract.pays_api,
            "pays_tgi": db_contract.pays_tgi,
            "pays_epe": db_contract.pays_epe,
            "notes": db_contract.notes,
            "active_taxes": {
                'fire_insurance': db_contract.fire_insurance,
                'api': db_contract.pays_api,
                'tgi': db_contract.pays_tgi,
                'epe': db_contract.pays_epe
            }
        }
        return cls(**contract_dict)
    
class RentalContractResponse(BaseModel):
    id: int
    tenant: TenantSimpleResponse
    start_date: str
    end_date: str
    garage_id: Optional[int] = None
    includes_garage: bool

    class Config:
        from_attributes = True
