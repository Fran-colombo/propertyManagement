from typing import List
from sqlalchemy.orm import Session, joinedload
from schemas.ownerDTO import CreateOwnerDTO
from models.person import Owner
from models.property import Property

class OwnerRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_owner(self, data: CreateOwnerDTO) -> Owner:
        owner_data = data.model_dump(exclude={"property_ids"})
        owner = Owner(**owner_data)
        self.db.add(owner)
        self.db.commit()
        self.db.refresh(owner)
        
        if data.property_ids:
            self.update_owner_properties(owner, data.property_ids)
            
        return owner

    def update_owner_properties(self, owner: Owner, property_ids: List[int]):
        self.db.query(Property).filter(Property.owner_id == owner.id).update({"owner_id": None})
        
        if property_ids:
            properties = self.db.query(Property).filter(Property.id.in_(property_ids)).all()
            for prop in properties:
                prop.owner_id = owner.id
        self.db.commit()

    def get_owners(self) -> List[Owner]:
        return (
            self.db.query(Owner)
            .filter(Owner.status == 1)
            .options(joinedload(Owner.properties), joinedload(Owner.garages))
            .all()
        )
    
    def get_by_id(self, owner_id: int) -> Owner | None:
        return (
            self.db.query(Owner)
            .filter(Owner.id == owner_id, Owner.status == 1)
            .options(joinedload(Owner.properties), joinedload(Owner.garages))
            .first()
        )
    
    def update(self, owner: Owner):
        self.db.commit()
        self.db.refresh(owner)

    def soft_delete(self, owner: Owner):
        owner.status = 0
        self.db.commit()