from math import ceil
from sqlalchemy.orm import Session, joinedload

from models.contract import RentalContract
from models.property import Garage
from models.property_sale import PropertySale
from repositories.contract_history_repository import AllContractRepository
from schemas.contract_historyDTO import AllContractResponse, PaginatedContractHistoryResponse, TenantMiniDTO
from services.transaction_service import normalize_currency
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
        filters = {"property_id": property_id, "month": month, "tenant": tenant}
        rows = [("alquiler", row) for row in self.repo.get_filtered(**filters)]
        rows += [("venta", sale) for sale in self.repo.get_sales(**filters)]
        rows.sort(
            key=lambda item: (
                item[1].sale_date if item[0] == "venta" else item[1].start_date,
                item[1].id or 0,
            ),
            reverse=True,
        )
        total = len(rows)
        start = (page - 1) * page_size
        page_rows = rows[start:start + page_size]
        pages = ceil(total / page_size) if page_size else 0
        return PaginatedContractHistoryResponse(
            items=[
                self._sale_to_response(obj) if kind == "venta" else self._to_response(obj)
                for kind, obj in page_rows
            ],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    def _sale_to_response(self, sale: PropertySale) -> AllContractResponse:
        buyer_name = sale.buyer_name or (sale.buyer.name if sale.buyer else None)
        due_dates = [inst.due_date for inst in sale.installments if inst.due_date]
        prop = sale.property
        return AllContractResponse(
            id=sale.id,
            kind="venta",
            sale_id=sale.id,
            sale_status=sale.status,
            currency=normalize_currency(sale.currency),
            total_amount=sale.total_amount,
            property_id=sale.property_id,
            tenant_name=buyer_name,
            start_date=sale.sale_date,
            end_date=max(due_dates) if due_dates else None,
            document_path=getattr(sale, "document_path", None),
            property_address=(
                " · ".join(
                    [prop.direction or "Sin dirección"]
                    + ([f"Piso {prop.floor}"] if prop.floor else [])
                    + ([f"Depto {prop.apartment}"] if prop.apartment else [])
                )
                if prop
                else None
            ),
            owner_name=sale.seller.name if sale.seller else None,
            property=prop,
            tenant=TenantMiniDTO(id=sale.buyer_owner_id or 0, name=buyer_name) if buyer_name else None,
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
        tenant = row.tenant
        tenant_name = getattr(row, "tenant_name", None) or (tenant.name if tenant else None)
        if tenant is None and tenant_name:
            tenant = TenantMiniDTO(id=row.tenant_id or 0, name=tenant_name)
        return AllContractResponse(
            id=row.id,
            rental_contract_id=row.rental_contract_id,
            property_id=row.property_id,
            tenant_id=row.tenant_id,
            tenant_name=tenant_name,
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
            tenant=tenant,
        )
