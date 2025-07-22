from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas.real_agencyDTO import RealAgencyCreate, RealAgencyRead, UpdateRealAgency
from services.real_agency_service import RealEstateAgencyService

router = APIRouter(prefix="/real-agencies", tags=["RealAgencies"])

def get_service(db: Session = Depends(get_db)):
    return RealEstateAgencyService(db)

@router.post("/", response_model=RealAgencyRead)
def create_real_agency(
    agency: RealAgencyCreate,
    service: RealEstateAgencyService = Depends(get_service)
):
    return service.create_real_agency(agency)

@router.get("/", response_model=List[RealAgencyRead])
def list_agencies(service: RealEstateAgencyService = Depends(get_service)):
    return service.list_real_agencies()

@router.get("/{agency_id}", response_model=RealAgencyRead)
def get_agency(agency_id: int, service: RealEstateAgencyService = Depends(get_service)):
    return service.get_real_agency(agency_id)

@router.put("/{agency_id}", response_model=RealAgencyRead)
def update_agency(
    agency_id: int, 
    data: UpdateRealAgency, 
    service: RealEstateAgencyService = Depends(get_service)
):
    return service.update_agency(agency_id, data)

@router.delete("/{agency_id}")
def delete_agency(agency_id: int, service: RealEstateAgencyService = Depends(get_service)):
    return service.delete_agency(agency_id)