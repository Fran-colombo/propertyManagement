from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas.garageDTO import GarageCreate, GarageRead, GarageUpdate
from schemas.saleDTO import PropertySaleResponse, SellPropertyDTO
from services import garage_service
from services.property_sale_service import PropertySaleService
from typing import List

router = APIRouter(prefix="/garages", tags=["Garages"])

@router.post("/", response_model=GarageRead, status_code=201)
def create_garage(garage: GarageCreate, db: Session = Depends(get_db)):
    return garage_service.create_garage(db, garage)

@router.get("/", response_model=List[GarageRead])
def list_garages(include_sold: bool = False, db: Session = Depends(get_db)):
    return garage_service.list_garages(db, include_sold=include_sold)

@router.get("/{garage_id}", response_model=GarageRead)
def get_garage(garage_id: int, db: Session = Depends(get_db)):
    garage = garage_service.get_garage(db, garage_id)
    if not garage:
        raise HTTPException(status_code=404, detail="Garage no encontrado")
    return garage

@router.put("/{garage_id}", response_model=GarageRead)
def update_garage(garage_id: int, garage: GarageUpdate, db: Session = Depends(get_db)):
    return garage_service.update_garage(db, garage_id, garage)

@router.delete("/{garage_id}")
def delete_garage(garage_id: int, db: Session = Depends(get_db)):
    return garage_service.delete_garage(db, garage_id)

@router.post("/{garage_id}/sell", response_model=PropertySaleResponse)
def sell_garage(garage_id: int, data: SellPropertyDTO, db: Session = Depends(get_db)):
    return PropertySaleService(db).sell_garage(garage_id, data)
