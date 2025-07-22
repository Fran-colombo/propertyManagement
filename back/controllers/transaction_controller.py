# from datetime import date
# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session
# from typing import List
# from controllers.contract_period_controller import PaymentData
# from database import get_db
# from models.contract_period import ContractPeriod
# from models.transactions import Transaction
# from schemas.enums.enums import PaymentStatusEnum
# from services.transaction_service import TransactionService
# from schemas.transactionDTO import TransactionResponseDTO  

# router = APIRouter(prefix="/transactions", tags=["Transactions"])

# @router.post("/{period_id}/payments")  
# def register_payment(
#     period_id: int,
#     payment: PaymentData,
#     db: Session = Depends(get_db)
# ):
#     period = db.query(ContractPeriod).get(period_id)
#     if not period:
#         raise HTTPException(status_code=404, detail="Periodo no encontrado")
    
#     if period.payment_status == "PAGADO":
#         raise HTTPException(status_code=400, detail="Este período ya está pagado")
    
#     remaining_amount = period.total_amount - period.amount_paid
    
#     transaction = Transaction(
#         period_id=period_id,
#         amount=payment.amount,
#         date=date.today(),
#         method=payment.method,
#         notes=payment.reference,
#         remaining_amount=remaining_amount - payment.amount  
#     )
#     db.add(transaction)

#     period.amount_paid += payment.amount
    
#     if period.amount_paid >= period.total_amount:
#         period.payment_status = PaymentStatusEnum.PAGADO
#     elif period.amount_paid > 0:
#         period.payment_status = PaymentStatusEnum.PARCIAL

#     db.commit()
    
#     return {
#         "message": "Pago registrado correctamente",
#         "remaining_amount": period.total_amount - period.amount_paid
#     }

# @router.get("/", response_model=List[TransactionResponseDTO])
# def get_transactions(db: Session = Depends(get_db)):
#     service = TransactionService(db)
#     transactions = service.get_all()
#     return transactions

# @router.get("/period/{period_id}", response_model=List[TransactionResponseDTO])
# def get_transactions_by_period(period_id: int, db: Session = Depends(get_db)):
#     service = TransactionService(db)
#     transactions = service.get_by_period(period_id)
#     if not transactions:
#         raise HTTPException(status_code=404, detail="No transactions found for this period")
#     return transactions

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

router = APIRouter(prefix="/transactions", tags=["Transactions"])

# @router.post("/{period_id}/payments")  
# def register_payment(
#     period_id: int,
#     payment: PaymentData,
#     db: Session = Depends(get_db)
# ):
#     period = db.query(ContractPeriod).get(period_id)
#     if not period:
#         raise HTTPException(status_code=404, detail="Periodo no encontrado")
    
#     if period.payment_status == "PAGADO":
#         raise HTTPException(status_code=400, detail="Este período ya está pagado")
    
#     remaining_amount = period.total_amount - period.amount_paid
    
#     transaction = Transaction(
#         period_id=period_id,
#         amount=payment.amount,
#         date=date.today(),
#         method=payment.method,
#         notes=payment.reference,
#         remaining_amount=remaining_amount - payment.amount  
#     )
#     db.add(transaction)
#     db.flush()  

    
#     history = TransactionHistory(
#         transaction_id=transaction.id,
#         amount=payment.amount,
#         date=date.today(),
#         method=payment.method,
#         notes=payment.reference,
#         contract_id=period.contract.id,
#         owner_id=period.contract.property.owner.id,
#         owner_name=period.contract.property.owner.name,
#         tenant_id=period.contract.tenant.id,
#         tenant_name=period.contract.tenant.name,
#         property_direction=period.contract.property.direction,
#         period_id=period.id,
#         period_start_date=period.start_date,
#         period_end_date=period.end_date,
#         period_due_date=period.due_date,
#         period_total_amount=period.total_amount
#     )
#     db.add(history)

    
#     period.amount_paid += payment.amount
#     if period.amount_paid >= period.total_amount:
#         period.payment_status = PaymentStatusEnum.PAGADO
#     elif period.amount_paid > 0:
#         period.payment_status = PaymentStatusEnum.PARCIAL

#     db.commit()
    
#     return {
#         "message": "Pago registrado correctamente",
#         "remaining_amount": period.total_amount - period.amount_paid
#     }


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

    history = TransactionHistory(
        transaction_id=transaction.id,
        amount=payment.amount,
        date=date.today(),
        method=payment.method,
        notes=payment.reference,
        contract_id=period.contract.id,
        owner_id=period.contract.property.owner.id,
        owner_name=period.contract.property.owner.name,
        tenant_id=period.contract.tenant.id,
        tenant_name=period.contract.tenant.name,
        property_direction=period.contract.property.direction,
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