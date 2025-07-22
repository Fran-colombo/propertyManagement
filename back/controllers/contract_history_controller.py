from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.contract_history_service import AllContractService
from schemas.contract_historyDTO import AllContractResponse

router = APIRouter(prefix="/contracts-history", tags=["All Contracts"])

@router.get("/{property_id}", response_model=list[AllContractResponse])
def get_contracts(property_id: int, db: Session = Depends(get_db)):
    service = AllContractService(db)
    return service.get_all_by_property_id(property_id)

@router.get("/", response_model=list[AllContractResponse])
def get_all_contracts(db: Session = Depends(get_db)):
    service = AllContractService(db)
    return service.get_all_contracts()