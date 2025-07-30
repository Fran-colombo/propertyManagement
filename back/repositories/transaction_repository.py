from sqlalchemy.orm import Session, joinedload
from models.contract import RentalContract
from models.contract_period import ContractPeriod
from models.property import Property
from models.transactions import Transaction
from schemas.enums.enums import PaymentStatusEnum
from schemas.transactionDTO import CreateTransactionDTO
from sqlalchemy.orm import joinedload


class TransactionRepository:
    def __init__(self, db: Session):
        self.db = db


    def create(self, data: CreateTransactionDTO) -> Transaction:
        transaction = Transaction(**data.dict())
        self.db.add(transaction)

        period = self.db.query(ContractPeriod).filter(ContractPeriod.id == data.period_id).first()
        if period:
            nuevo_monto_pagado = period.amount_paid + data.amount
            if nuevo_monto_pagado > period.total_amount:
                raise ValueError("No se puede pagar más de lo que se debe.")

            period.amount_paid = nuevo_monto_pagado

            if period.amount_paid == period.total_amount:
                period.payment_status = PaymentStatusEnum.PAGADO
            elif 0 < period.amount_paid < period.total_amount:
                period.payment_status = PaymentStatusEnum.PARCIAL
            else:
                period.payment_status = PaymentStatusEnum.PENDIENTE

        self.db.commit()
        self.db.refresh(transaction)
        return transaction
    

    def get_all(self) -> list[Transaction]:
        return (
            self.db.query(Transaction)
            .options(
                joinedload(Transaction.period)
                .joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.property)
                .joinedload(Property.owner),
                joinedload(Transaction.period)
                .joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.tenant)
            )
            .all()
        )

    def get_by_period(self, period_id: int) -> list[Transaction]:
        return (
            self.db.query(Transaction)
            .filter(Transaction.period_id == period_id)
            .options(
                joinedload(Transaction.period)
                .joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.property)
                .joinedload(Property.owner),
                joinedload(Transaction.period)
                .joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.tenant)
            )
            .all()
        )