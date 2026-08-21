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
        
        if prop.rental_contract and prop.rental_contract.status == 1:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar una propiedad con contrato activo"
            )
            
        self.repo.soft_delete(prop)
        return {"message": "Propiedad eliminada correctamente"}

    def _map_to_response(self, prop: Property) -> PropertyResponse:
        """Mapea un objeto Property a PropertyResponse"""
        rental_contract = None
        if prop.rental_contract and prop.rental_contract.status == 1:
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
                        ContractPeriodResponse.from_orm(period)
                        for period in prop.rental_contract.periods
                    ],
                    start_date=prop.rental_contract.start_date,
                    end_date=prop.rental_contract.end_date,
                    document_path=getattr(prop.rental_contract, "document_path", None),
                    pays_epe=bool(prop.rental_contract.pays_epe),
                    pays_tgi=bool(prop.rental_contract.pays_tgi),
                    pays_api=bool(prop.rental_contract.pays_api),
                    fire_insurance=bool(prop.rental_contract.fire_insurance),
                    notes=prop.rental_contract.notes,
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
                    rental_contract_id=(
                        g.rental_contract.id
                        if g.rental_contract and g.rental_contract.status == 1
                        else None
                    ),
                )
                for g in prop.garages
            ]
        )