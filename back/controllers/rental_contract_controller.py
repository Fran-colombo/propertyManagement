from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from schemas.contract_periodDTO import ContractPeriodResponse
from database import get_db
from services.rental_contract_service import RentalContractService
from schemas.contractDTO import CreateContractDTO, ContractResponse

router = APIRouter(prefix="/contracts", tags=["Contracts"])

@router.post("/", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(
    contract_data: CreateContractDTO,
    db: Session = Depends(get_db)
):
    service = RentalContractService(db)
    try:
        service.release_properties_from_ended_contracts()
        contract = service.create_contract(contract_data)
        db.commit()  
        return contract
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo crear el contrato: {str(e)}"
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo crear el contrato: {str(e)}"
        )


@router.get("/adjust-next-month", response_model=List[ContractResponse])
def contracts_adjusting_next_month(db: Session = Depends(get_db)):
    from datetime import date
    from dateutil.relativedelta import relativedelta
    today = date.today()
    next_month = today + relativedelta(months=1)
    service = RentalContractService(db)
    return service.get_contracts_next_adjustment(next_month.year, next_month.month)

@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    service = RentalContractService(db)
    return service.get_contract(contract_id)

@router.get("/pending/", response_model=List[ContractResponse])
def get_pending_contracts(db: Session = Depends(get_db)):
    service = RentalContractService(db)
    return service.get_pending_contracts()


@router.get("/{contract_id}/periods/overdue/", response_model=List[ContractPeriodResponse])
def get_overdue_periods(contract_id: int, db: Session = Depends(get_db)):
    service = RentalContractService(db)
    return service.get_overdue_periods(contract_id)

@router.get("/", response_model=List[ContractResponse])
def get_all_contracts(db: Session = Depends(get_db)):
    service = RentalContractService(db)
    return service.get_all_contracts()

@router.delete("/{contract_id}/cancel", status_code=204)
def cancel_contract(contract_id: int, db: Session = Depends(get_db)):
    contractService = RentalContractService(db)
    contractService.cancel_contract(contract_id)
    contractService.release_properties_from_ended_contracts()
    

