from typing import List, Optional
from datetime import date
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from sqlalchemy.orm import Session
from schemas.contract_periodDTO import ContractPeriodResponse
from database import get_db
from services.rental_contract_service import RentalContractService
from services.contract_document_parser import parse_contract_pdf
from schemas.contractDTO import CreateContractDTO, ContractResponse, UpdateContractDTO
from schemas.updateIndexDTO import ApplyIndexDTO

router = APIRouter(prefix="/contracts", tags=["Contracts"])

_UPLOADS_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "properties_data", "uploads")
)
UPLOAD_DIR = os.path.join(_UPLOADS_ROOT, "terminations")
CONTRACT_UPLOAD_DIR = os.path.join(_UPLOADS_ROOT, "contracts")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CONTRACT_UPLOAD_DIR, exist_ok=True)

ALLOWED_RECEIPT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
}

ALLOWED_CONTRACT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
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


@router.post("/parse-document")
async def parse_document(document: UploadFile = File(...)):
    content_type = document.content_type or ""
    filename = (document.filename or "").lower()
    if content_type != "application/pdf" and not filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Para autocompletar usá un PDF con texto. Las fotos/escaneos se pueden adjuntar igual al guardar.",
        )
    data = await document.read()
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    return parse_contract_pdf(data)


@router.post("/{contract_id}/apply-index", response_model=ContractResponse)
def apply_index(
    contract_id: int,
    dto: ApplyIndexDTO,
    db: Session = Depends(get_db)
):
    service = RentalContractService(db)
    return service.apply_index(contract_id, dto.value)


@router.patch("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: int,
    dto: UpdateContractDTO,
    db: Session = Depends(get_db),
):
    service = RentalContractService(db)
    return service.update_contract(contract_id, dto)


@router.post("/{contract_id}/document", response_model=ContractResponse)
async def upload_contract_document(
    contract_id: int,
    document: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    service = RentalContractService(db)
    service.get_contract(contract_id)

    content_type = document.content_type or ""
    filename = document.filename or ""
    if content_type not in ALLOWED_CONTRACT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Archivo inválido. Usá PDF o imagen (jpg/png/webp).",
        )
    ext = os.path.splitext(filename)[1].lower() or ".bin"
    stored_name = f"contract_{contract_id}_{uuid.uuid4().hex}{ext}"
    dest = os.path.join(CONTRACT_UPLOAD_DIR, stored_name)
    data = await document.read()
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    with open(dest, "wb") as f:
        f.write(data)
    path = f"/uploads/contracts/{stored_name}"
    return service.attach_document(contract_id, path)


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
    return ContractResponse.from_orm(service.get_contract(contract_id))

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
