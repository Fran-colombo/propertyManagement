from sqlalchemy.orm import Session
from models.property import Garage
from schemas.garageDTO import GarageCreate

class GarageRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(db: Session, garage: GarageCreate):
        db_garage = Garage(**garage.dict())
        db.add(db_garage)
        db.commit()
        db.refresh(db_garage)
        return db_garage

    def get_all_garages(db: Session):
        return db.query(Garage).all()

    def get_garage_by_id(db: Session, garage_id: int):
        return db.query(Garage).filter(Garage.id == garage_id).first()