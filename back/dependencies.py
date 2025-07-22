from fastapi import Depends
from sqlalchemy.orm import Session
from services.property_service import PropertyService
from services.owner_service import OwnerService
from database import get_db

def get_property_service(db: Session = Depends(get_db)) -> PropertyService:
    return PropertyService(db)

def get_owner_service(db: Session = Depends(get_db)) -> OwnerService:
    return OwnerService(db)