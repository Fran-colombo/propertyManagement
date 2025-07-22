from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas.garageDTO import GarageCreate, GarageRead
from services import garage_service
from typing import List

router = APIRouter(prefix="/garages", tags=["Garages"])

@router.post("/", response_model=GarageRead)
def create_garage(garage: GarageCreate, db: Session = Depends(get_db)):
    return garage_service.create_garage(db, garage)

@router.get("/", response_model=List[GarageRead])
def list_garages(db: Session = Depends(get_db)):
    return garage_service.list_garages(db)

@router.get("/{garage_id}", response_model=GarageRead)
def get_garage(garage_id: int, db: Session = Depends(get_db)):
    return garage_service.get_garage(db, garage_id)
