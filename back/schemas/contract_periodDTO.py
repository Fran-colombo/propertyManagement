from datetime import date
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from utils.proration import period_rent, days_overdue
from utils.contract_display import contract_location_label

class TenantResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class PropertySimpleResponse(BaseModel):
    id: int
    direction: str
    floor: Optional[str] = None
    apartment: Optional[str] = None

class AgencySimpleResponse(BaseModel):
    id: int
    name: str

class RentalContractSimpleResponse(BaseModel):
    id: int
    property: Optional[PropertySimpleResponse] = None
    tenant: Optional[TenantResponse] = None
    real_agency: Optional[AgencySimpleResponse] = None
    currency: Optional[str] = None
    index_type: Optional[str] = None
    frequency_adjustment: Optional[str] = None
    base_index_value: Optional[float] = None
    last_index_value: Optional[float] = None
    start_date: Optional[date] = None
    base_rent: Optional[float] = None
    pays_epe: Optional[bool] = None
    pays_tgi: Optional[bool] = None
    pays_api: Optional[bool] = None
    fire_insurance: Optional[bool] = None
    document_path: Optional[str] = None
    garage_label: Optional[str] = None

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


class PeriodRentUpdate(BaseModel):
    indexed_amount: float = Field(..., gt=0)
    apply_forward: bool = False

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
    termination_note: Optional[str] = None
    is_prorated: bool = False
    proration_note: Optional[str] = None
    period_rent: Optional[float] = None
    late_fee_amount: Optional[float] = 0
    days_overdue: Optional[int] = 0

    @classmethod
    def from_orm(cls, period):
        period_dict = period.__dict__.copy()

        contract_obj = period.contract

        property_dict = None
        if contract_obj and contract_obj.property:
            property_dict = {
                'id': contract_obj.property.id,
                'direction': contract_obj.property.direction,
                'floor': getattr(contract_obj.property, 'floor', None),
                'apartment': getattr(contract_obj.property, 'apartment', None),
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
                'real_agency': agency_dict,
                'currency': getattr(contract_obj.currency, 'value', contract_obj.currency) if contract_obj.currency else None,
                'index_type': getattr(contract_obj.index_type, 'value', contract_obj.index_type) if contract_obj.index_type else None,
                'frequency_adjustment': getattr(contract_obj.frequency_adjustment, 'value', contract_obj.frequency_adjustment) if contract_obj.frequency_adjustment else None,
                'base_index_value': getattr(contract_obj, 'base_index_value', None),
                'last_index_value': getattr(contract_obj, 'last_index_value', None),
                'start_date': contract_obj.start_date,
                'base_rent': contract_obj.base_rent,
                'pays_epe': getattr(contract_obj, 'pays_epe', False),
                'pays_tgi': getattr(contract_obj, 'pays_tgi', False),
                'pays_api': getattr(contract_obj, 'pays_api', False),
                'fire_insurance': getattr(contract_obj, 'fire_insurance', False),
                'document_path': getattr(contract_obj, 'document_path', None),
                'garage_label': contract_location_label(contract_obj) if not property_dict else None,
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

        period_dict['is_prorated'] = bool(getattr(period, 'is_prorated', False))
        period_dict['proration_note'] = getattr(period, 'proration_note', None)
        period_dict['period_rent'] = period_rent(period)
        period_dict['late_fee_amount'] = getattr(period, 'late_fee_amount', 0) or 0
        period_dict['days_overdue'] = days_overdue(getattr(period, 'due_date', None))
        status = getattr(period, 'payment_status', None)
        period_dict['payment_status'] = status.value if hasattr(status, 'value') else status
        period_dict.pop('_sa_instance_state', None)

        return cls(**period_dict)