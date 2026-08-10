from sqlalchemy.orm import Session
from repositories.garage_repository import GarageRepository, to_garage_read
from schemas.garageDTO import GarageCreate, GarageRead
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
