from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from models.contract_period import ContractPeriod
from pydantic import BaseModel, Field
from datetime import date
from models.transactions import Transaction

from schemas.contract_periodDTO import ContractPeriodResponse, PeriodTaxesUpdate, PeriodRentUpdate
from schemas.enums.enums import PaymentStatusEnum
from services.contract_period_service import ContractPeriodService
from utils.proration import period_total

router = APIRouter(prefix="/periods", tags=["Contract Periods"])

class PaymentData(BaseModel):
    amount: float = Field(0, ge=0)
    method: str = "carga_inicial"
    reference: Optional[str] = None
    overpay_reason: Optional[str] = None
    overpay_note: Optional[str] = None
    received_by: Optional[str] = "DUENO"
    apply_late_fee: bool = False
    late_fee_mode: Optional[str] = None
    late_fee_daily_rate: Optional[float] = Field(None, ge=0)
    late_fee_amount: Optional[float] = Field(None, ge=0)
    already_paid: bool = False


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

@router.get("/by-month", response_model=List[ContractPeriodResponse])
def get_periods_by_month(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
):
    today = date.today()
    year = year or today.year
    month = month or today.month
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mes inválido")
    service = ContractPeriodService(db)
    try:
        periods = service.get_periods_for_month(year, month)
        return [ContractPeriodResponse.from_orm(p) for p in periods]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener períodos del mes: {str(e)}"
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
    period.total_amount = period_total(period, rent_base)

    
    db.commit()
    db.refresh(period)
    return ContractPeriodResponse.from_orm(period)


@router.patch("/{period_id}/rent", response_model=ContractPeriodResponse)
def update_period_rent(period_id: int, data: PeriodRentUpdate, db: Session = Depends(get_db)):
    from services.rental_contract_service import RentalContractService

    return RentalContractService(db).update_period_rent(
        period_id,
        data.indexed_amount,
        data.apply_forward,
    )


@router.get("/contract/{contract_id}/", response_model=List[ContractPeriodResponse])
def get_all_contract_periods(contract_id: int, db: Session = Depends(get_db)):
    """
    Obtiene TODOS los períodos de un contrato específico
    """
    service = ContractPeriodService(db)
    try:
        periods = service.get_all_contract_periods(contract_id)
        return [ContractPeriodResponse.from_orm(p) for p in (periods or [])]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener los períodos del contrato: {str(e)}"
        )
