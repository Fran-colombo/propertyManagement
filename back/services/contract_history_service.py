from sqlalchemy.orm import Session

from repositories.contract_history_repository import AllContractRepository
from schemas.contract_historyDTO import AllContractResponse


class AllContractService:
    def __init__(self, db: Session):
        self.repo = AllContractRepository(db)

    def get_all_by_property_id(self, property_id: int) -> list[AllContractResponse]:
        return self.repo.get_by_property_id(property_id)
    
    def get_all_contracts(self) -> list[AllContractResponse]:
        return self.repo.get_all_contracts() 