from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from schemas.ownerDTO import CreateOwnerDTO, OwnerResponse, UpdateOwnerDTO
from services.owner_service import OwnerService
from database import get_db

router = APIRouter(prefix="/owners", tags=["Owners"])

def get_service(db: Session = Depends(get_db)):
    return OwnerService(db)

@router.post("", response_model=OwnerResponse)
def create_owner(data: CreateOwnerDTO, service: OwnerService = Depends(get_service)):
    return service.create_owner(data)

@router.get("/", response_model=List[OwnerResponse])
def get_owners(service: OwnerService = Depends(get_service)):
    return service.get_owners()

@router.put("/{owner_id}", response_model=OwnerResponse)
def update_owner(owner_id: int, data: UpdateOwnerDTO, service: OwnerService = Depends(get_service)):
    return service.update_owner(owner_id, data)

@router.delete("/{owner_id}")
def delete_owner(owner_id: int, service: OwnerService = Depends(get_service)):
    return service.delete_owner(owner_id)