from fastapi import HTTPException
from sqlalchemy.orm import Session
from repositories.garage_repository import GarageRepository, to_garage_read
from schemas.garageDTO import GarageCreate, GarageRead, GarageUpdate
from typing import List


def create_garage(db: Session, garage: GarageCreate) -> GarageRead:
    created = GarageRepository.create(db, garage)
    full = GarageRepository.get_garage_by_id(db, created.id)
    return to_garage_read(full)


def list_garages(db: Session) -> List[GarageRead]:
    return [to_garage_read(g) for g in GarageRepository.get_all_garages(db)]


def get_garage(db: Session, garage_id: int) -> GarageRead:
    garage = GarageRepository.get_garage_by_id(db, garage_id)
    return to_garage_read(garage) if garage else None


def update_garage(db: Session, garage_id: int, data: GarageUpdate) -> GarageRead:
    garage = GarageRepository.get_garage_by_id(db, garage_id)
    if not garage:
        raise HTTPException(status_code=404, detail="Garage no encontrado")
    updates = data.model_dump(exclude_unset=True)
    if "number" in updates and not (updates["number"] or "").strip():
        raise HTTPException(status_code=400, detail="El número de garage no puede estar vacío")
    if "owner_id" in updates:
        owner = GarageRepository.get_active_owner(db, updates["owner_id"])
        if not owner:
            raise HTTPException(status_code=400, detail="El dueño indicado no existe")
    if "property_id" in updates and updates["property_id"] is not None:
        prop = GarageRepository.get_active_property(db, updates["property_id"])
        if not prop:
            raise HTTPException(status_code=400, detail="La propiedad indicada no existe")
    updated = GarageRepository.update(db, garage, data)
    return to_garage_read(updated)
