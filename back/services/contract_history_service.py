from sqlalchemy.orm import Session

from repositories.contract_history_repository import AllContractRepository
from schemas.contract_historyDTO import AllContractResponse


class AllContractService:
    def __init__(self, db: Session):
        self.repo = AllContractRepository(db)

    def get_all_by_property_id(self, property_id: int) -> list[AllContractResponse]:
        return [self._to_response(row) for row in self.repo.get_by_property_id(property_id)]
    
    def get_all_contracts(self) -> list[AllContractResponse]:
        return [self._to_response(row) for row in self.repo.get_all_contracts()]

    def _to_response(self, row) -> AllContractResponse:
        owner_name = None
        if row.property and getattr(row.property, "owner", None):
            owner_name = row.property.owner.name
        return AllContractResponse(
            id=row.id,
            rental_contract_id=row.rental_contract_id,
            property_id=row.property_id,
            tenant_id=row.tenant_id,
            start_date=row.start_date,
            end_date=row.end_date,
            cancelled=row.cancelled or 0,
            cancellation_reason=row.cancellation_reason,
            cancelled_by=row.cancelled_by,
            settlement_amount=row.settlement_amount,
            settlement_direction=row.settlement_direction,
            receipt_path=row.receipt_path,
            document_path=getattr(row, "document_path", None),
            property_address=row.property_address,
            owner_name=owner_name,
            property=row.property,
            tenant=row.tenant,
        )
