from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from models.contract_period import ContractPeriod
from pydantic import BaseModel, Field
from datetime import date
from models.transactions import Transaction

from schemas.contract_periodDTO import ContractPeriodResponse, PeriodTaxesUpdate
from schemas.enums.enums import PaymentStatusEnum
from services.contract_period_service import ContractPeriodService

router = APIRouter(prefix="/periods", tags=["Contract Periods"])

class PaymentData(BaseModel):
    amount: float
    method: str
    reference: Optional[str] = None


@router.post("/{period_id}/pay")
def register_payment(period_id: int, payment: PaymentData, db: Session = Depends(get_db)):
    period = db.query(ContractPeriod).filter(ContractPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    
    if period.payment_status == "PAGADO":
        raise HTTPException(status_code=400, detail="Este período ya está pagado")
    

    transaction = Transaction(
        period_id=period_id,
        amount=payment.amount,
        date=date.today(),
        method=payment.method,
        notes=payment.reference
    )
    db.add(transaction)

    period.amount_paid += payment.amount
    period.payment_date = date.today()
    period.payment_method = payment.method
    period.payment_reference = payment.reference

    if period.amount_paid >= period.total_amount:
        period.payment_status = PaymentStatusEnum.PAGADO
    elif period.amount_paid > 0:
        period.payment_status = PaymentStatusEnum.PARCIAL

    db.commit()
    return {"message": "Pago registrado correctamente"}


@router.get("/contract/{contract_id}/pending", response_model=List[ContractPeriodResponse])
def get_pending_periods(contract_id: int, db: Session = Depends(get_db)):
    service = ContractPeriodService(db)
    try:
        periods = service.get_pending_periods(contract_id)
        return periods or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener periodos pendientes: {str(e)}")


@router.get("/contract/{contract_id}/current")
def get_current_periods(contract_id: int, db: Session = Depends(get_db)):
    try:
        service = ContractPeriodService(db)
        result = service.get_current_and_previous_periods(contract_id)
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class TaxAmountUpdate(BaseModel):
    fire_proof: Optional[float] = Field(None, ge=0)  
    tgi: Optional[float] = Field(None, ge=0)
    epe: Optional[float] = Field(None, ge=0)
    api: Optional[float] = Field(None, ge=0)

@router.get("/pending", response_model=List[ContractPeriodResponse])
def get_all_pending_periods(db: Session = Depends(get_db)):
    service = ContractPeriodService(db)
    try:
        periods = service.get_all_pending_periods()
        return [ContractPeriodResponse.from_orm(p) for p in periods]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener todos los períodos pendientes: {str(e)}"
        )
    
@router.get("/current-pending", response_model=List[ContractPeriodResponse])
def get_current_pending_periods(db: Session = Depends(get_db)):
    service = ContractPeriodService(db)
    try:
        periods = service.get_all_relevant_periods()
        return [ContractPeriodResponse.from_orm(p) for p in periods]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener todos los períodos pendientes: {str(e)}"
        )



@router.put("/{period_id}/taxes", response_model=ContractPeriodResponse)
def update_period_taxes(period_id: int, taxes: PeriodTaxesUpdate, db: Session = Depends(get_db)):
    period = db.query(ContractPeriod).filter(ContractPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Período no encontrado")
    if period.payment_status == "PAGADO":
        raise HTTPException(status_code=500, detail="El contrato ya está pagado, no podes modificar los impuestos ahora")
    if taxes.epe is not None:
        period.epe_amount = taxes.epe if taxes.epe != 0 else None
    if taxes.tgi is not None:
        period.tgi_amount = taxes.tgi if taxes.tgi != 0 else None
    if taxes.api is not None:
        period.api_amount = taxes.api if taxes.api != 0 else None
    if taxes.fire_insurance is not None:
        period.fire_proof_amount = taxes.fire_insurance if taxes.fire_insurance != 0 else None

    rent_base = period.indexed_amount if period.indexed_amount is not None else period.base_rent
    period.total_amount = rent_base + sum(
        imp for imp in [
            period.epe_amount or 0,
            period.tgi_amount or 0,
            period.api_amount or 0,
            period.fire_proof_amount or 0
        ]
    )

    
    db.commit()
    db.refresh(period)
    return ContractPeriodResponse.from_orm(period)

@router.get("/contract/{contract_id}/", response_model=List[ContractPeriodResponse])
def get_all_contract_periods(contract_id: int, db: Session = Depends(get_db)):
    """
    Obtiene TODOS los períodos de un contrato específico
    """
    service = ContractPeriodService(db)
    try:
        periods = service.get_all_contract_periods(contract_id)
        return periods or []
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener los períodos del contrato: {str(e)}"
        )
