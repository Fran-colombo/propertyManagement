from sqlalchemy.orm import Session
from models.contract_period import ContractPeriod
from sqlalchemy.orm import joinedload
from models.transactions import Transaction
from models.contract_period import ContractPeriod

class ContractPeriodRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_contract(self, contract_id: int):
        return self.db.query(ContractPeriod).filter_by(contract_id=contract_id).all()


    def get_transactions_with_details(db: Session):
        return db.query(Transaction)\
            .options(
                joinedload(Transaction.period).joinedload(ContractPeriod.contract)
            )\
            .all()


    def create(self, period: ContractPeriod):
        self.db.add(period)
        self.db.commit()
        self.db.refresh(period)
        return period


    def delete_by_contract(self, contract_id: int):
        self.db.query(ContractPeriod).filter_by(contract_id=contract_id).delete()
        self.db.commit()

