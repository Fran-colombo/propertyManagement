from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session
from schemas.contract_periodDTO import ContractPeriodResponse
from models.contract import RentalContract
from models.property import Property
from models.property_sale import PropertySale
from models.transaction_history import TransactionHistory
from schemas.propertyDTO import CreatePropertyDTO, UpdatePropertyDTO, GarageResponse, OwnerSimpleResponse, PropertyResponse, RentalContractWithPeriodsResponse, TenantSimpleResponse
from repositories.property_repository import PropertyRepository
from utils.contract_display import property_display_label

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

    def update_property(self, prop_id: int, data: UpdatePropertyDTO) -> PropertyResponse:
        prop = self.repo.get_by_id(prop_id)
        if not prop:
            raise HTTPException(
                status_code=404,
                detail="Propiedad no encontrada"
            )
        updates = data.model_dump(exclude_unset=True)
        if not updates:
            return self._map_to_response(prop)
        if "owner_id" in updates:
            owner = self.repo.get_owner_by_id(updates["owner_id"])
            if not owner:
                raise HTTPException(
                    status_code=400,
                    detail="El dueño indicado no existe"
                )
        if "direction" in updates and not (updates["direction"] or "").strip():
            raise HTTPException(
                status_code=400,
                detail="La dirección no puede estar vacía"
            )
        try:
            updated = self.repo.update_property(prop, data)
            if {"direction", "floor", "apartment"}.intersection(updates):
                self._refresh_address_snapshots(updated)
            return self._map_to_response(updated)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error al actualizar propiedad: {str(e)}"
            )

    def _refresh_address_snapshots(self, prop: Property) -> None:
        label = property_display_label(prop)
        db = self.repo.db
        sale_ids = [
            row[0]
            for row in db.query(PropertySale.id).filter(PropertySale.property_id == prop.id).all()
        ]
        if sale_ids:
            db.query(TransactionHistory).filter(
                TransactionHistory.sale_id.in_(sale_ids)
            ).update(
                {TransactionHistory.property_direction: label},
                synchronize_session=False,
            )
        contract_ids = [
            row[0]
            for row in db.query(RentalContract.id).filter(RentalContract.property_id == prop.id).all()
        ]
        if contract_ids:
            db.query(TransactionHistory).filter(
                TransactionHistory.contract_id.in_(contract_ids)
            ).update(
                {TransactionHistory.property_direction: label},
                synchronize_session=False,
            )
        db.commit()

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
                    currency=(
                        prop.rental_contract.currency.value
                        if hasattr(prop.rental_contract.currency, "value")
                        else prop.rental_contract.currency
                    ),
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
            ],
            management_status=getattr(prop, "management_status", None) or "ACTIVE",
        )