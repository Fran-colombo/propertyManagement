from sqlalchemy.orm import Session, joinedload
from models.property import Garage
from schemas.garageDTO import GarageCreate, GarageRead


class GarageRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def create(db: Session, garage: GarageCreate):
        db_garage = Garage(**garage.model_dump())
        db.add(db_garage)
        db.commit()
        db.refresh(db_garage)
        return db_garage

    @staticmethod
    def get_all_garages(db: Session):
        return (
            db.query(Garage)
            .options(
                joinedload(Garage.owner),
                joinedload(Garage.property),
                joinedload(Garage.rental_contract),
            )
            .filter(Garage.status == 1)
            .all()
        )

    @staticmethod
    def get_garage_by_id(db: Session, garage_id: int):
        return (
            db.query(Garage)
            .options(
                joinedload(Garage.owner),
                joinedload(Garage.property),
                joinedload(Garage.rental_contract),
            )
            .filter(Garage.id == garage_id)
            .first()
        )


def to_garage_read(garage: Garage) -> GarageRead:
    return GarageRead(
        id=garage.id,
        number=garage.number,
        owner_id=garage.owner_id,
        property_id=garage.property_id,
        owner_name=garage.owner.name if garage.owner else None,
        property_direction=garage.property.direction if garage.property else None,
        rental_contract_id=garage.rental_contract.id if garage.rental_contract else None,
    )
