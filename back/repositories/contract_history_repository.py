from sqlalchemy.orm import Session, joinedload
from models.contract_history import ContractHistory

class AllContractRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_property_id(self, property_id: int):
        return self.db.query(ContractHistory)\
            .options(joinedload(ContractHistory.property), joinedload(ContractHistory.tenant))\
            .filter(ContractHistory.property_id == property_id)\
            .all()
    
    def get_all_contracts(self):
        return self.db.query(ContractHistory)\
            .options(joinedload(ContractHistory.property), joinedload(ContractHistory.tenant))\
            .all()

    def save(self, contract: ContractHistory):
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract
