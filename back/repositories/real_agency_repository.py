from typing import List
from sqlalchemy.orm import Session, joinedload
from models.property import RealAgency
from schemas.real_agencyDTO import RealAgencyCreate

class RealAgencyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: RealAgencyCreate) -> RealAgency:
        agency = RealAgency(**data.model_dump())
        self.db.add(agency)
        self.db.commit()
        self.db.refresh(agency)
        return agency

    def get_all(self) -> List[RealAgency]:
        return (
            self.db.query(RealAgency)
            .filter(RealAgency.status == 1)
            .options(joinedload(RealAgency.contracts))
            .all()
        )

    def get_by_id(self, agency_id: int) -> RealAgency | None:
        return (
            self.db.query(RealAgency)
            .filter(RealAgency.id == agency_id, RealAgency.status == 1)
            .options(joinedload(RealAgency.contracts))
            .first()
        )
    
    def update(self, agency: RealAgency) -> None:
        self.db.commit()
        self.db.refresh(agency)

    def soft_delete(self, agency: RealAgency) -> None:
        agency.status = 0
        self.db.commit()