from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from models.property import Garage, Property
from models.person import Owner
from models.contract import RentalContract
from schemas.garageDTO import GarageCreate, GarageRead, GarageUpdate
from utils.contract_display import garage_display_label


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
    def get_all_garages(db: Session, include_sold: bool = False):
        query = (
            db.query(Garage)
            .outerjoin(Property, Garage.property_id == Property.id)
            .options(
                joinedload(Garage.owner),
                joinedload(Garage.property),
                joinedload(Garage.rental_contract).joinedload(RentalContract.tenant),
            )
            .filter(Garage.status == 1)
            .filter(
                or_(
                    Garage.property_id.is_(None),
                    Property.management_status.is_(None),
                    Property.management_status != "SOLD_OUT",
                )
            )
        )
        if not include_sold:
            query = query.filter(
                or_(Garage.management_status.is_(None), Garage.management_status != "SOLD_OUT")
            )
        return query.all()

    @staticmethod
    def soft_delete(db: Session, garage: Garage):
        garage.status = 0
        db.commit()

    @staticmethod
    def get_garage_by_id(db: Session, garage_id: int):
        return (
            db.query(Garage)
            .options(
                joinedload(Garage.owner),
                joinedload(Garage.property),
                joinedload(Garage.rental_contract).joinedload(RentalContract.tenant),
            )
            .filter(Garage.id == garage_id, Garage.status == 1)
            .first()
        )

    @staticmethod
    def get_active_owner(db: Session, owner_id: int):
        return (
            db.query(Owner)
            .filter(Owner.id == owner_id, Owner.status == 1)
            .first()
        )

    @staticmethod
    def get_active_property(db: Session, property_id: int):
        return (
            db.query(Property)
            .filter(Property.id == property_id, Property.status == 1)
            .first()
        )

    @staticmethod
    def update(db: Session, garage: Garage, data: GarageUpdate):
        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(garage, field, value)
        db.commit()
        return GarageRepository.get_garage_by_id(db, garage.id)


def to_garage_read(garage: Garage) -> GarageRead:
    active = (
        garage.rental_contract
        if garage.rental_contract and garage.rental_contract.status == 1
        else None
    )
    tenant_name = None
    if active and active.tenant:
        tenant_name = active.tenant.name
    return GarageRead(
        id=garage.id,
        number=garage.number,
        owner_id=garage.owner_id,
        property_id=garage.property_id,
        owner_name=garage.owner.name if garage.owner else None,
        property_direction=garage.property.direction if garage.property else None,
        rental_contract_id=active.id if active else None,
        tenant_name=tenant_name,
        management_status=(garage.management_status or "ACTIVE").upper(),
        label=garage_display_label(garage),
        contract_end_date=active.end_date if active else None,
        contract_document_path=getattr(active, "document_path", None) if active else None,
        contract_property_id=active.property_id if active else None,
    )
