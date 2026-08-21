from math import ceil
from sqlalchemy.orm import Session, joinedload

from models.contract import RentalContract
from models.property import Garage
from repositories.contract_history_repository import AllContractRepository
from schemas.contract_historyDTO import AllContractResponse, PaginatedContractHistoryResponse
from utils.contract_display import contract_owner


class AllContractService:
    def __init__(self, db: Session):
        self.repo = AllContractRepository(db)

    def get_all_by_property_id(self, property_id: int) -> list[AllContractResponse]:
        return [self._to_response(row) for row in self.repo.get_by_property_id(property_id)]
    
    def get_all_contracts(self) -> list[AllContractResponse]:
        return [self._to_response(row) for row in self.repo.get_all_contracts()]

    def get_paginated(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        property_id: int | None = None,
        month: str | None = None,
        tenant: str | None = None,
    ) -> PaginatedContractHistoryResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        items, total = self.repo.get_paginated(
            page=page,
            page_size=page_size,
            property_id=property_id,
            month=month,
            tenant=tenant,
        )
        pages = ceil(total / page_size) if page_size else 0
        return PaginatedContractHistoryResponse(
            items=[self._to_response(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    def _to_response(self, row) -> AllContractResponse:
        owner_name = None
        if row.property and getattr(row.property, "owner", None):
            owner_name = row.property.owner.name
        elif row.rental_contract_id:
            contract = (
                self.repo.db.query(RentalContract)
                .options(
                    joinedload(RentalContract.garage).joinedload(Garage.owner),
                    joinedload(RentalContract.property),
                )
                .filter(RentalContract.id == row.rental_contract_id)
                .first()
            )
            owner = contract_owner(contract)
            if owner:
                owner_name = owner.name
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
