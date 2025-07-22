# from datetime import date
# from pydantic import BaseModel, ConfigDict, Field
# from typing import Optional

# class TenantResponse(BaseModel):
#     id: int
#     name: str
#     email: Optional[str] = None
#     phone: Optional[str] = None
# class PropertySimpleResponse(BaseModel):
#     id: int
#     direction: str
# class AgencySimpleResponse(BaseModel):
#     id: int
#     name: str

# class RentalContractSimpleResponse(BaseModel):
#     id: int
#     property:  Optional[PropertySimpleResponse] = None
#     tenant: TenantResponse
#     real_agency: Optional[AgencySimpleResponse]

# class PeriodTaxesResponse(BaseModel):
#     epe: Optional[float] = None
#     tgi: Optional[float] = None
#     api: Optional[float] = None
#     fire_insurance: Optional[float] = None
# class PeriodTaxesUpdate(BaseModel):  # Esta es la clase que faltaba
#     epe: Optional[float] = Field(None, ge=0)
#     tgi: Optional[float] = Field(None, ge=0)
#     api: Optional[float] = Field(None, ge=0)
#     fire_insurance: Optional[float] = Field(None, ge=0)

# class ContractPeriodResponse(BaseModel):
#     model_config = ConfigDict(from_attributes=True)
    
#     id: int
#     contract_id: int
#     contract: Optional[RentalContractSimpleResponse] = None
#     start_date: date
#     end_date: date
#     due_date: date
#     base_rent: float
#     indexed_amount: Optional[float] = None
#     total_amount: float
#     payment_status: str
#     amount_paid: float
#     payment_method: Optional[str] = None
#     payment_reference: Optional[str] = None
#     taxes: PeriodTaxesResponse
#     active_taxes: Optional[dict] = None 

 

#     # @classmethod
#     # def from_orm(cls, period):
#     #     period_dict = period.__dict__
        
#     #     # Construir el objeto contract con tenant y agency
#     #     contract_dict = {
#     #         'id': period.contract.id,
#     #         'property': {
#     #             'id': period.contract.property.id,
#     #             'direction': period.contract.property.direction
#     #         },  
#     #         'tenant': {
#     #             'id': period.contract.tenant.id,
#     #             'name': period.contract.tenant.name,
#     #             'email': period.contract.tenant.email,
#     #             'phone': period.contract.tenant.phone
#     #         },
#     #         'real_agency': {
#     #             'id': period.contract.real_agency.id,
#     #             'name': period.contract.real_agency.name
#     #         } if period.contract.real_agency else None
#     #     }
        
#     #     period_dict['contract'] = contract_dict
#     #     period_dict['taxes'] = {
#     #         'epe': period.epe_amount,
#     #         'tgi': period.tgi_amount,
#     #         'api': period.api_amount,
#     #         'fire_insurance': period.fire_proof_amount
#     #     }
        
#     #     period_dict['active_taxes'] = {
#     #         'epe': contract.pays_epe,
#     #         'tgi': contract.pays_tgi,
#     #         'api': contract.pays_api,
#     #         'fire_insurance': contract.fire_insurance
#     #     }
#     #     return cls(**period_dict)

#     @classmethod
#     def from_orm(cls, period):
#         period_dict = period.__dict__

#         contract_obj = period.contract

#         # Chequeo seguro para property
#         property_dict = None
#         if contract_obj.property:
#             property_dict = {
#                 'id': contract_obj.property.id,
#                 'direction': contract_obj.property.direction
#             }

#         # Chequeo seguro para tenant (supongo siempre debería existir, pero por las dudas)
#         tenant_dict = None
#         if contract_obj.tenant:
#             tenant_dict = {
#                 'id': contract_obj.tenant.id,
#                 'name': contract_obj.tenant.name,
#                 'email': contract_obj.tenant.email,
#                 'phone': contract_obj.tenant.phone
#             }

#         # Chequeo seguro para real_agency
#         agency_dict = None
#         if contract_obj.real_agency:
#             agency_dict = {
#                 'id': contract_obj.real_agency.id,
#                 'name': contract_obj.real_agency.name
#             }

#         contract_dict = {
#             'id': contract_obj.id,
#             'property': property_dict,
#             'tenant': tenant_dict,
#             'real_agency': agency_dict
#         }

#         period_dict['contract'] = contract_dict
#         period_dict['taxes'] = {
#             'epe': period.epe_amount,
#             'tgi': period.tgi_amount,
#             'api': period.api_amount,
#             'fire_insurance': period.fire_proof_amount
#         }

#         period_dict['active_taxes'] = {
#             'epe': contract_obj.pays_epe,
#             'tgi': contract_obj.pays_tgi,
#             'api': contract_obj.pays_api,
#             'fire_insurance': contract_obj.fire_insurance
#         }

#         return cls(**period_dict)


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

        # Construcción segura de property_dict
        property_dict = None
        if contract_obj and contract_obj.property:
            property_dict = {
                'id': contract_obj.property.id,
                'direction': contract_obj.property.direction
            }

        # Construcción segura de tenant_dict
        tenant_dict = None
        if contract_obj and contract_obj.tenant:
            tenant_dict = {
                'id': contract_obj.tenant.id,
                'name': contract_obj.tenant.name,
                'email': getattr(contract_obj.tenant, 'email', None),
                'phone': getattr(contract_obj.tenant, 'phone', None)
            }

        # Construcción segura de agency_dict
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
        
        # Manejo seguro de los montos de impuestos
        period_dict['taxes'] = {
            'epe': getattr(period, 'epe_amount', None),
            'tgi': getattr(period, 'tgi_amount', None),
            'api': getattr(period, 'api_amount', None),
            'fire_insurance': getattr(period, 'fire_proof_amount', None)
        }

        # Manejo seguro de active_taxes
        period_dict['active_taxes'] = {
            'epe': getattr(contract_obj, 'pays_epe', False),
            'tgi': getattr(contract_obj, 'pays_tgi', False),
            'api': getattr(contract_obj, 'pays_api', False),
            'fire_insurance': getattr(contract_obj, 'fire_insurance', False)
        } if contract_obj else None

        return cls(**period_dict)