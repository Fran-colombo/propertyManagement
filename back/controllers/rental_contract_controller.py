from typing import List, Optional
from datetime import date
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from sqlalchemy.orm import Session
from schemas.contract_periodDTO import ContractPeriodResponse
from database import get_db
from services.rental_contract_service import RentalContractService
from schemas.contractDTO import CreateContractDTO, ContractResponse
from schemas.updateIndexDTO import ApplyIndexDTO

router = APIRouter(prefix="/contracts", tags=["Contracts"])

UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "properties_data", "uploads", "terminations")
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_RECEIPT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
}


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
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo crear el contrato: {str(e)}"
        )


@router.post("/{contract_id}/apply-index", response_model=ContractResponse)
def apply_index(
    contract_id: int,
    dto: ApplyIndexDTO,
    db: Session = Depends(get_db)
):
    service = RentalContractService(db)
    return service.apply_index(contract_id, dto.value)


@router.get("/adjust-next-month", response_model=List[ContractResponse])
def contracts_adjusting_next_month(db: Session = Depends(get_db)):
    from dateutil.relativedelta import relativedelta
    today = date.today()
    next_month = today + relativedelta(months=1)
    service = RentalContractService(db)
    if not hasattr(service, "get_contracts_next_adjustment"):
        return []
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


@router.post("/{contract_id}/cancel")
async def cancel_contract(
    contract_id: int,
    cancelled_by: str = Form(...),
    reason: str = Form(...),
    effective_date: date = Form(...),
    settlement_amount: float = Form(0),
    settlement_direction: str = Form("SIN_MONTO"),
    waive_remaining_rent: str = Form("false"),
    receipt: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    service = RentalContractService(db)
    receipt_path = None
    receipt_name = None

    if receipt and receipt.filename:
        content_type = receipt.content_type or ""
        if content_type not in ALLOWED_RECEIPT_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Comprobante inválido. Usá imagen (jpg/png/webp/gif) o PDF.",
            )
        ext = os.path.splitext(receipt.filename)[1].lower() or ".bin"
        filename = f"termination_{contract_id}_{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, filename)
        data = await receipt.read()
        with open(dest, "wb") as f:
            f.write(data)
        receipt_path = f"/uploads/terminations/{filename}"
        receipt_name = receipt.filename

    waive = str(waive_remaining_rent).strip().lower() in ("1", "true", "yes", "on")

    result = service.cancel_contract(
        contract_id,
        cancelled_by=cancelled_by,
        reason=reason,
        effective_date=effective_date,
        settlement_amount=settlement_amount,
        settlement_direction=settlement_direction,
        waive_remaining_rent=waive,
        receipt_path=receipt_path,
        receipt_original_name=receipt_name,
    )
    service.release_properties_from_ended_contracts()
    return result
