from fastapi import HTTPException
from sqlalchemy.orm import Session
from schemas.ownerDTO import CreateOwnerDTO, UpdateOwnerDTO
from repositories.owner_repository import OwnerRepository

class OwnerService:
    def __init__(self, db: Session):
        self.repo = OwnerRepository(db)

    def create_owner(self, data: CreateOwnerDTO):
        return self.repo.create_owner(data)
    
    def get_owners(self):
        return self.repo.get_owners()
    
    def update_owner(self, owner_id: int, data: UpdateOwnerDTO):
        owner = self.repo.get_by_id(owner_id)
        if not owner:
            raise HTTPException(status_code=404, detail="Owner not found")

        update_data = data.model_dump(exclude_unset=True)
        
        if 'property_ids' in update_data:
            self.repo.update_owner_properties(owner, update_data.pop('property_ids'))
            
        for key, value in update_data.items():
            setattr(owner, key, value)
            
        self.repo.update(owner)
        return owner

    def delete_owner(self, owner_id: int):
        owner = self.repo.get_by_id(owner_id)
        if not owner:
            raise HTTPException(status_code=404, detail="Owner not found")
        
        self.repo.soft_delete(owner)
        return {"message": "Owner deleted"}