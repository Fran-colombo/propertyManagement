from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict
from datetime import date
from schemas.enums.enums import IndexTypeEnum, AdjustmentFrequencyEnum, CurrencyEnum

from schemas.propertyDTO import TenantSimpleResponse


class HistoricalRentTier(BaseModel):
    from_date: date
    indexed_amount: float = Field(..., gt=0)


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
    base_index_value: Optional[float] = None
    current_index_value: Optional[float] = None
    includes_garage: bool = False
    garage_id: Optional[int] = None
    fire_insurance: bool = False
    pays_api: bool = False
    pays_tgi: bool = False
    pays_epe: bool = False
    epe_amount: Optional[float] = Field(None, ge=0)
    tgi_amount: Optional[float] = Field(None, ge=0)
    api_amount: Optional[float] = Field(None, ge=0)
    fire_insurance_amount: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    mark_past_as_paid: bool = False
    historical_rents: Optional[List[HistoricalRentTier]] = None

class UpdateContractDTO(BaseModel):
    real_agency_id: Optional[int] = None
    fire_insurance: Optional[bool] = None
    pays_api: Optional[bool] = None
    pays_tgi: Optional[bool] = None
    pays_epe: Optional[bool] = None
    epe_amount: Optional[float] = Field(None, ge=0)
    tgi_amount: Optional[float] = Field(None, ge=0)
    api_amount: Optional[float] = Field(None, ge=0)
    fire_insurance_amount: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    mark_past_as_paid: Optional[bool] = None
    historical_rents: Optional[List[HistoricalRentTier]] = None


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
    base_index_value: Optional[float] = None
    last_index_value: Optional[float] = None
    includes_garage: bool
    garage_id: Optional[int] = None
    real_agency_id: Optional[int] = None
    fire_insurance: bool
    pays_api: bool
    pays_tgi: bool
    pays_epe: bool
    epe_amount: Optional[float] = None
    tgi_amount: Optional[float] = None
    api_amount: Optional[float] = None
    fire_insurance_amount: Optional[float] = None
    status: int
    notes: Optional[str] = None
    document_path: Optional[str] = None
    active_taxes: Optional[Dict[str, bool]] = None
    

    @classmethod
    def from_orm(cls, db_contract):
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
            "base_index_value": getattr(db_contract, "base_index_value", None),
            "last_index_value": getattr(db_contract, "last_index_value", None),
            "real_agency_id": db_contract.real_agency_id,
            "includes_garage": db_contract.includes_garage,
            "garage_id": db_contract.garage_id,
            "status": db_contract.status,
            "fire_insurance": db_contract.fire_insurance,
            "pays_api": db_contract.pays_api,
            "pays_tgi": db_contract.pays_tgi,
            "pays_epe": db_contract.pays_epe,
            "epe_amount": getattr(db_contract, "epe_amount", None),
            "tgi_amount": getattr(db_contract, "tgi_amount", None),
            "api_amount": getattr(db_contract, "api_amount", None),
            "fire_insurance_amount": getattr(db_contract, "fire_insurance_amount", None),
            "notes": db_contract.notes,
            "document_path": getattr(db_contract, "document_path", None),
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
