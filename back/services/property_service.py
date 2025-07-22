# from typing import List, Optional
# from fastapi import Depends, HTTPException
# from sqlalchemy.orm import Session
# from database import get_db
# from schemas.contract_periodDTO import ContractPeriodResponse
# from schemas.propertyDTO import (
#     CreatePropertyDTO, PropertyCreateResponse, PropertyResponse,
#     OwnerSimpleResponse, RentalContractWithPeriodsResponse, TenantSimpleResponse, GarageResponse
# )
# from repositories.property_repository import PropertyRepository
# from models.property import Property


# class PropertyService:
#     def __init__(self, db: Session):
#         self.repo = PropertyRepository(db)

#     def create_property(self, data: CreatePropertyDTO) -> PropertyCreateResponse:
#         try:
#             prop = self.repo.create_property(data)
#             return PropertyCreateResponse(
#                 id=prop.id,
#                 direction=prop.direction,
#                 floor=prop.floor,
#                 apartment=prop.apartment,
#                 owner=OwnerSimpleResponse(
#                     id=prop.owner.id,
#                     name=prop.owner.name,
#                     email=prop.owner.email
#                 ),
#                 rental_contract=None,
#                 garages=[]
#             )
#         except ValueError as e:
#             raise HTTPException(status_code=400, detail=str(e))
#         except Exception as e:
#             raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")



#     def get_properties(self) -> List[PropertyResponse]:
#         properties = self.repo.get_properties()
#         response = []
#         for prop in properties:
#             rental_contract = None
#             if (
#                 prop.rental_contract 
#                 and prop.rental_contract.status == 1 
#                 and prop.rental_contract.tenant
#             ):
#                 rental_contract = RentalContractWithPeriodsResponse(
#                     id=prop.rental_contract.id,
#                     tenant=TenantSimpleResponse(
#                         id=prop.rental_contract.tenant.id,
#                         name=prop.rental_contract.tenant.name
#                     ),
#                     start_date=prop.rental_contract.start_date,  
#                     end_date=prop.rental_contract.end_date,      
#                     periods=[
#                         ContractPeriodResponse(
#                             id=period.id,
#                             contract_id=period.contract_id,
#                             start_date=period.start_date,
#                             end_date=period.end_date,
#                             due_date=period.due_date,
#                             base_rent=period.base_rent,
#                             indexed_amount=period.indexed_amount,
#                             total_amount=period.total_amount,
#                             amount_paid=period.amount_paid,
#                             payment_status=period.payment_status.value,
#                             payment_method=period.payment_method,
#                             payment_reference=period.payment_reference,
#                             taxes={
#                                 "epe": period.epe_amount,
#                                 "tgi": period.tgi_amount,
#                                 "api": period.api_amount,
#                                 "fire_insurance": period.fire_proof_amount,
#                             }
#                         )
#                         for period in prop.rental_contract.periods
#                     ]
#                 )
            
#             response.append(PropertyResponse(
#                 id=prop.id,
#                 direction=prop.direction,
#                 floor=prop.floor,
#                 apartment=prop.apartment,
#                 owner=OwnerSimpleResponse(
#                     id=prop.owner.id,
#                     name=prop.owner.name,
#                     email=prop.owner.email
#                 ) if prop.owner else None,
#                 rental_contract=rental_contract,
#                 garages=[
#                     GarageResponse(
#                         id=g.id,
#                         number=g.number,
#                         rental_contract_id=g.rental_contract.id if g.rental_contract else None
#                     ) for g in prop.garages
#                 ]
#             ))
#         return response
    
#     def get_property_by_id(self, prop_id:int,  db : Session ) :
#         prop = db.query(Property).filter(Property.id == prop_id).first()
#         if not prop:
#             raise HTTPException(
#                 status_code=404,
#                 detail="Property not found"
#             )
#         return prop
    

 

#     def delete_property(self, property_id: int):
#         prop = self.repo.get_by_id(property_id)
#         if not prop:
#             raise HTTPException(status_code=404, detail="Property not found")

#         self.repo.soft_delete(prop)
#         return {"message": "Property deleted"}

from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session
from schemas.contract_periodDTO import ContractPeriodResponse
from models.property import Property
from schemas.propertyDTO import CreatePropertyDTO, GarageResponse, OwnerSimpleResponse, PropertyResponse, RentalContractWithPeriodsResponse, TenantSimpleResponse
from repositories.property_repository import PropertyRepository

class PropertyService:
    def __init__(self, db: Session):
        self.repo = PropertyRepository(db)

    def create_property(self, data: CreatePropertyDTO) -> PropertyResponse:
        try:
            prop = self.repo.create_property(data)
            return self._map_to_response(prop)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=500, 
                detail=f"Error al crear propiedad: {str(e)}"
            )

    def get_properties(self) -> List[PropertyResponse]:
        try:
            properties = self.repo.get_properties()
            return [self._map_to_response(prop) for prop in properties]
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error al obtener propiedades: {str(e)}"
            )

    def get_property_by_id(self, prop_id: int) -> PropertyResponse:
        prop = self.repo.get_by_id(prop_id)
        if not prop:
            raise HTTPException(
                status_code=404,
                detail="Propiedad no encontrada"
            )
        return self._map_to_response(prop)

    def delete_property(self, property_id: int) -> dict:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise HTTPException(
                status_code=404,
                detail="Propiedad no encontrada"
            )
        
        # Verificar si tiene contratos activos
        if prop.rental_contract and prop.rental_contract.status == 1:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar una propiedad con contrato activo"
            )
            
        self.repo.soft_delete(prop)
        return {"message": "Propiedad eliminada correctamente"}

    # def _map_to_response(self, prop: Property) -> PropertyResponse:
    #     """Mapea un objeto Property a PropertyResponse"""
    #     rental_contract = None
    #     if prop.rental_contract and prop.rental_contract.status == 1:
    #         rental_contract = RentalContractWithPeriodsResponse(
    #             # ... (mantener tu mapeo existente)
    #         )
        
    #     return PropertyResponse(
    #         id=prop.id,
    #         direction=prop.direction,
    #         floor=prop.floor,
    #         apartment=prop.apartment,
    #         owner=OwnerSimpleResponse(
    #             id=prop.owner.id,
    #             name=prop.owner.name,
    #             email=prop.owner.email
    #         ) if prop.owner else None,
    #         rental_contract=rental_contract,
    #         garages=[
    #             GarageResponse(
    #                 id=g.id,
    #                 number=g.number,
    #                 rental_contract_id=g.rental_contract.id if g.rental_contract else None
    #             ) for g in prop.garages
    #         ]
    #     )
    def _map_to_response(self, prop: Property) -> PropertyResponse:
        """Mapea un objeto Property a PropertyResponse"""
        rental_contract = None
        if prop.rental_contract and prop.rental_contract.status == 1:
            # Ensure all required fields are present
            if (prop.rental_contract.id and 
                prop.rental_contract.tenant and 
                prop.rental_contract.start_date and 
                prop.rental_contract.end_date):
                
                rental_contract = RentalContractWithPeriodsResponse(
                    id=prop.rental_contract.id,
                    tenant=TenantSimpleResponse(
                        id=prop.rental_contract.tenant.id,
                        name=prop.rental_contract.tenant.name
                    ),
                    periods=[
                        ContractPeriodResponse(
                            id=period.id,
                            contract_id=period.contract_id,
                            start_date=period.start_date,
                            end_date=period.end_date,
                            due_date=period.due_date,
                            base_rent=period.base_rent,
                            indexed_amount=period.indexed_amount,
                            total_amount=period.total_amount,
                            amount_paid=period.amount_paid,
                            payment_status=period.payment_status.value,
                            payment_method=period.payment_method,
                            payment_reference=period.payment_reference,
                            taxes={
                                "epe": period.epe_amount,
                                "tgi": period.tgi_amount,
                                "api": period.api_amount,
                                "fire_insurance": period.fire_proof_amount,
                            }
                        )
                        for period in prop.rental_contract.periods
                    ],
                    start_date=prop.rental_contract.start_date,
                    end_date=prop.rental_contract.end_date
                )
        
        return PropertyResponse(
            id=prop.id,
            direction=prop.direction,
            floor=prop.floor,
            apartment=prop.apartment,
            owner=OwnerSimpleResponse(
                id=prop.owner.id,
                name=prop.owner.name,
                email=prop.owner.email
            ) if prop.owner else None,
            rental_contract=rental_contract,
            garages=[
                GarageResponse(
                    id=g.id,
                    number=g.number,
                    rental_contract_id=g.rental_contract.id if g.rental_contract else None
                ) for g in prop.garages
            ]
        )