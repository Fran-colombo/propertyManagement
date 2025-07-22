from sqlalchemy.orm import Session
from repositories.garage_repository import GarageRepository
from schemas.garageDTO import  GarageCreate


def create_garage(db: Session, garage: GarageCreate):
    return GarageRepository.create(db, garage)

def list_garages(db: Session):
    return GarageRepository.get_all_garages(db)

def get_garage(db: Session, garage_id: int):
    return GarageRepository.get_garage_by_id(db, garage_id)