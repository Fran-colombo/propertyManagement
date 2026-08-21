from sqlalchemy.orm import Session, joinedload
from models.contract_history import ContractHistory
from models.property import Property


class AllContractRepository:
    def __init__(self, db: Session):
        self.db = db

    def _options(self):
        return (
            joinedload(ContractHistory.property).joinedload(Property.owner),
            joinedload(ContractHistory.tenant),
        )

    def get_by_property_id(self, property_id: int):
        return self.db.query(ContractHistory)\
            .options(*self._options())\
            .filter(ContractHistory.property_id == property_id)\
            .all()
    
    def get_all_contracts(self):
        return self.db.query(ContractHistory)\
            .options(*self._options())\
            .all()

    def save(self, contract: ContractHistory):
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract
