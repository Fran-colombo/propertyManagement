from datetime import date
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class TenantResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class PropertySimpleResponse(BaseModel):
    id: int
    direction: str

class AgencySimpleResponse(BaseModel):
    id: int
    name: str

class RentalContractSimpleResponse(BaseModel):
    id: int
    property: Optional[PropertySimpleResponse] = None
    tenant: TenantResponse
    real_agency: Optional[AgencySimpleResponse]

class PeriodTaxesResponse(BaseModel):
    epe: Optional[float] = None
    tgi: Optional[float] = None
    api: Optional[float] = None
    fire_insurance: Optional[float] = None

class PeriodTaxesUpdate(BaseModel):
    epe: Optional[float] = Field(None, ge=0)
    tgi: Optional[float] = Field(None, ge=0)
    api: Optional[float] = Field(None, ge=0)
    fire_insurance: Optional[float] = Field(None, ge=0)

class ContractPeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    contract_id: int
    contract: Optional[RentalContractSimpleResponse] = None
    start_date: date
    end_date: date
    due_date: date
    base_rent: float
    indexed_amount: Optional[float] = None
    total_amount: float
    payment_status: str
    amount_paid: float
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    taxes: Optional[PeriodTaxesResponse] = None
    active_taxes: Optional[dict] = None

    @classmethod
    def from_orm(cls, period):
        period_dict = period.__dict__.copy()

        contract_obj = period.contract

        property_dict = None
        if contract_obj and contract_obj.property:
            property_dict = {
                'id': contract_obj.property.id,
                'direction': contract_obj.property.direction
            }

        tenant_dict = None
        if contract_obj and contract_obj.tenant:
            tenant_dict = {
                'id': contract_obj.tenant.id,
                'name': contract_obj.tenant.name,
                'email': getattr(contract_obj.tenant, 'email', None),
                'phone': getattr(contract_obj.tenant, 'phone', None)
            }

        agency_dict = None
        if contract_obj and contract_obj.real_agency:
            agency_dict = {
                'id': contract_obj.real_agency.id,
                'name': contract_obj.real_agency.name
            }

        contract_dict = None
        if contract_obj:
            contract_dict = {
                'id': contract_obj.id,
                'property': property_dict,
                'tenant': tenant_dict,
                'real_agency': agency_dict
            }

        period_dict['contract'] = contract_dict
        
        period_dict['taxes'] = {
            'epe': getattr(period, 'epe_amount', None),
            'tgi': getattr(period, 'tgi_amount', None),
            'api': getattr(period, 'api_amount', None),
            'fire_insurance': getattr(period, 'fire_proof_amount', None)
        }

        period_dict['active_taxes'] = {
            'epe': getattr(contract_obj, 'pays_epe', False),
            'tgi': getattr(contract_obj, 'pays_tgi', False),
            'api': getattr(contract_obj, 'pays_api', False),
            'fire_insurance': getattr(contract_obj, 'fire_insurance', False)
        } if contract_obj else None

        return cls(**period_dict)