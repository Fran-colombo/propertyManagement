from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from models.contract_history import ContractHistory
from models.property import Property
from models.person import Tenant


class AllContractRepository:
    def __init__(self, db: Session):
        self.db = db

    def _options(self):
        return (
            joinedload(ContractHistory.property).joinedload(Property.owner),
            joinedload(ContractHistory.tenant),
        )

    def _apply_filters(self, query, property_id=None, month=None, tenant=None):
        if property_id:
            query = query.filter(ContractHistory.property_id == property_id)
        if month:
            year_s, month_s = month.split("-", 1)
            query = query.filter(
                extract("year", ContractHistory.start_date) == int(year_s),
                extract("month", ContractHistory.start_date) == int(month_s),
            )
        if tenant:
            query = query.join(ContractHistory.tenant).filter(
                Tenant.name.ilike(f"%{tenant.strip()}%")
            )
        return query

    def get_by_property_id(self, property_id: int):
        return (
            self.db.query(ContractHistory)
            .options(*self._options())
            .filter(ContractHistory.property_id == property_id)
            .order_by(ContractHistory.id.desc())
            .all()
        )

    def get_all_contracts(self):
        return (
            self.db.query(ContractHistory)
            .options(*self._options())
            .order_by(ContractHistory.id.desc())
            .all()
        )

    def get_paginated(self, *, page: int, page_size: int, property_id=None, month=None, tenant=None):
        count_query = self._apply_filters(
            self.db.query(ContractHistory),
            property_id=property_id,
            month=month,
            tenant=tenant,
        )
        total = count_query.order_by(None).count()

        items_query = self._apply_filters(
            self.db.query(ContractHistory).options(*self._options()),
            property_id=property_id,
            month=month,
            tenant=tenant,
        )
        items = (
            items_query.order_by(ContractHistory.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def save(self, contract: ContractHistory):
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract
