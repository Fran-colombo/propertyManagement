from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract, or_
from models.contract_history import ContractHistory
from models.property import Property
from models.property_sale import PropertySale
from models.person import Owner, Tenant


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
            term = f"%{tenant.strip()}%"
            query = query.outerjoin(ContractHistory.tenant).filter(
                or_(
                    Tenant.name.ilike(term),
                    ContractHistory.tenant_name.ilike(term),
                )
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

    def get_filtered(self, *, property_id=None, month=None, tenant=None):
        return (
            self._apply_filters(
                self.db.query(ContractHistory).options(*self._options()),
                property_id=property_id,
                month=month,
                tenant=tenant,
            )
            .order_by(ContractHistory.id.desc())
            .all()
        )

    def get_sales(self, *, property_id=None, month=None, tenant=None):
        query = self.db.query(PropertySale).options(
            joinedload(PropertySale.property),
            joinedload(PropertySale.seller),
            joinedload(PropertySale.buyer),
            joinedload(PropertySale.installments),
        )
        if property_id:
            query = query.filter(PropertySale.property_id == property_id)
        if month:
            year_s, month_s = month.split("-", 1)
            query = query.filter(
                extract("year", PropertySale.sale_date) == int(year_s),
                extract("month", PropertySale.sale_date) == int(month_s),
            )
        if tenant:
            term = f"%{tenant.strip()}%"
            query = query.outerjoin(Owner, PropertySale.buyer_owner_id == Owner.id).filter(
                or_(PropertySale.buyer_name.ilike(term), Owner.name.ilike(term))
            )
        return query.all()

    def save(self, contract: ContractHistory):
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract
