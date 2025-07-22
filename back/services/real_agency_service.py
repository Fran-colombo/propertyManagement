# from fastapi import HTTPException
# from repositories.real_agency_repository import RealAgencyRepository
# from schemas.real_agencyDTO import RealAgencyCreate, UpdateRealAgency
# from models.property import RealAgency

# class RealEstateAgencyService:
#     def __init__(self, repo: RealAgencyRepository):
#         self.repo = repo

#     def create_real_agency(self, agency: RealAgencyCreate) -> RealAgency:
#         return self.repo.create(agency)

#     def list_real_agencies(self) -> list[RealAgency]:
#         return self.repo.get_all()

#     def get_real_agency(self, agency_id: int) -> RealAgency:
#         agency = self.repo.get_by_id(agency_id)
#         if not agency:
#             raise HTTPException(status_code=404, detail="Agency not found")
#         return agency

#     def update_agency(self, agency_id: int, data: UpdateRealAgency) -> RealAgency:
#         agency = self.repo.get_by_id(agency_id)
#         if not agency:
#             raise HTTPException(status_code=404, detail="Agency not found")

#         if data.name is not None:
#             agency.name = data.name
#         if data.direction is not None:
#             agency.direction = data.direction

#         self.repo.update(agency)
#         return agency

#     def delete_agency(self, agency_id: int):
#         agency = self.repo.get_by_id(agency_id)
#         if not agency:
#             raise HTTPException(status_code=404, detail="Agency not found")

#         self.repo.soft_delete(agency)
#         return {"message": "Agency deleted"}

from fastapi import HTTPException
from sqlalchemy.orm import Session
from models.property import RealAgency
from schemas.real_agencyDTO import RealAgencyCreate, UpdateRealAgency, RealAgencyRead
from repositories.real_agency_repository import RealAgencyRepository

class RealEstateAgencyService:
    def __init__(self, db: Session):
        self.repo = RealAgencyRepository(db)

    def create_real_agency(self, agency: RealAgencyCreate) -> RealAgency:
        return self.repo.create(agency)

    def list_real_agencies(self) -> list[RealAgency]:
        return self.repo.get_all()

    def get_real_agency(self, agency_id: int) -> RealAgency:
        agency = self.repo.get_by_id(agency_id)
        if not agency:
            raise HTTPException(status_code=404, detail="Agency not found")
        return agency

    def update_agency(self, agency_id: int, data: UpdateRealAgency) -> RealAgency:
        agency = self.repo.get_by_id(agency_id)
        if not agency:
            raise HTTPException(status_code=404, detail="Agency not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(agency, key, value)

        self.repo.update(agency)
        return agency

    def delete_agency(self, agency_id: int) -> dict:
        agency = self.repo.get_by_id(agency_id)
        if not agency:
            raise HTTPException(status_code=404, detail="Agency not found")

        self.repo.soft_delete(agency)
        return {"message": "Agency deleted successfully"}