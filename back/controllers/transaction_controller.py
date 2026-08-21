from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from models.transaction_history import TransactionHistory
from controllers.contract_period_controller import PaymentData
from database import get_db
from models.contract_period import ContractPeriod
from models.transactions import Transaction
from schemas.enums.enums import PaymentStatusEnum
from services.transaction_service import TransactionService
from schemas.transactionDTO import TransactionHistoryResponse, TransactionResponseDTO
from utils.contract_display import contract_location_label, contract_owner

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.post("/{period_id}/payments")  
def register_payment(period_id: int, payment: PaymentData, db: Session = Depends(get_db)):
    period = db.query(ContractPeriod).get(period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    
    if period.payment_status == "PAGADO":
        raise HTTPException(status_code=400, detail="Este período ya está pagado")
    
    remaining_amount = period.total_amount - period.amount_paid
    
    transaction = Transaction(
        period_id=period_id,
        amount=payment.amount,
        date=date.today(),
        method=payment.method,
        notes=payment.reference,
        remaining_amount=remaining_amount - payment.amount  
    )
    db.add(transaction)
    db.flush()

    new_amount_paid = period.amount_paid + payment.amount
    new_payment_status = (
        "PAGADO" if new_amount_paid >= period.total_amount
        else "PARCIAL" if new_amount_paid > 0
        else "PENDIENTE"
    )

    contract = period.contract
    owner = contract_owner(contract)
    tenant = contract.tenant if contract else None

    history = TransactionHistory(
        transaction_id=transaction.id,
        amount=payment.amount,
        date=date.today(),
        method=payment.method,
        notes=payment.reference,
        contract_id=contract.id if contract else None,
        owner_id=owner.id if owner else None,
        owner_name=owner.name if owner else "Sin dueño",
        tenant_id=tenant.id if tenant else None,
        tenant_name=tenant.name if tenant else "Sin inquilino",
        property_direction=contract_location_label(contract),
        period_id=period.id,
        period_start_date=period.start_date,
        period_end_date=period.end_date,
        period_due_date=period.due_date,
        period_total_amount=period.total_amount,
        period_amount_paid=new_amount_paid,  
        period_payment_status=new_payment_status  
    )
    db.add(history)

    period.amount_paid = new_amount_paid
    period.payment_status = new_payment_status

    db.commit()
    
    return {
        "message": "Pago registrado correctamente",
        "remaining_amount": period.total_amount - period.amount_paid
    }

@router.get("/", response_model=List[TransactionHistoryResponse])
def get_transactions(db: Session = Depends(get_db)):
    service = TransactionService(db)
    return service.get_all_history()

@router.get("/period/{period_id}", response_model=List[TransactionHistoryResponse])
def get_transactions_by_period(period_id: int, db: Session = Depends(get_db)):
    service = TransactionService(db)
    return service.get_history_by_period(period_id)

@router.get("/original/{period_id}", response_model=List[TransactionResponseDTO])
def get_original_transactions_by_period(period_id: int, db: Session = Depends(get_db)):
    """Endpoint opcional para obtener datos originales (solo si es necesario)"""
    service = TransactionService(db)
    transactions = service.get_by_period(period_id)
    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found for this period")
    return transactions