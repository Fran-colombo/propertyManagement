from typing import List
from sqlalchemy.orm import Session, joinedload
from schemas.propertyDTO import CreatePropertyDTO, UpdatePropertyDTO
from models.property import Property, Garage
from models.contract import RentalContract
from models.person import Owner

from sqlalchemy import or_

class PropertyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_property(self, data: CreatePropertyDTO) -> Property:
        try:
            property_data = data.model_dump(exclude_unset=True)
            
            if "real_agency_id" in property_data and property_data["real_agency_id"] is None:
                del property_data["real_agency_id"]

            new_property = Property(**property_data)
            self.db.add(new_property)
            self.db.commit()
            self.db.refresh(new_property)

            if new_property.owner_id:
                owner = self.db.query(Owner).get(new_property.owner_id)
                if owner:
                    owner.properties.append(new_property)
                    self.db.commit()
            
            return new_property
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error al crear propiedad: {str(e)}")

    def get_properties(self) -> List[Property]:
        return (
            self.db.query(Property)
            .filter(Property.status == 1)
            .filter(
                or_(
                    Property.management_status.is_(None),
                    Property.management_status.in_(("ACTIVE", "DELIVERED")),
                )
            )
            .options(
                joinedload(Property.owner),
                joinedload(Property.rental_contract)
                    .joinedload(RentalContract.tenant),
                joinedload(Property.rental_contract)
                    .joinedload(RentalContract.periods),
                joinedload(Property.garages)
                    .joinedload(Garage.rental_contract)
            )
            .all()
        )

    def get_by_id(self, property_id: int) -> Property | None:
        return (
            self.db.query(Property)
            .filter(Property.id == property_id, Property.status == 1)
            .options(
                joinedload(Property.owner),
                joinedload(Property.rental_contract)
                    .joinedload(RentalContract.tenant),
                joinedload(Property.rental_contract)
                    .joinedload(RentalContract.periods),
                joinedload(Property.garages)
                    .joinedload(Garage.rental_contract)
            )
            .first()
        )

    def get_owner_by_id(self, owner_id: int) -> Owner | None:
        return (
            self.db.query(Owner)
            .filter(Owner.id == owner_id, Owner.status == 1)
            .first()
        )

    def update_property(self, property_obj: Property, data: UpdatePropertyDTO) -> Property:
        try:
            updates = data.model_dump(exclude_unset=True)
            for field, value in updates.items():
                setattr(property_obj, field, value)
            self.db.commit()
            return self.get_by_id(property_obj.id) or property_obj
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error al actualizar propiedad: {str(e)}")

    def soft_delete(self, property_obj: Property) -> None:
        try:
            property_obj.status = 0
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error al eliminar propiedad: {str(e)}")