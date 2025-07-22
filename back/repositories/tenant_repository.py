# from fastapi import HTTPException
# from sqlalchemy.orm import Session
# from models.person import Tenant
# from schemas.tenantDTO import CreateTenantDTO, UpdateTenantDTO

# class TenantRepository:
#     def __init__(self, db: Session):
#         self.db = db

#     def create(self, data: CreateTenantDTO) -> Tenant:
#         obj = Tenant(**data.dict())
#         self.db.add(obj)
#         self.db.commit()
#         self.db.refresh(obj)
#         return obj

#     def get_by_id(self, tenant_id: int) -> Tenant | None:
#         return self.db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.status == 1).first()

#     def get_all(self) -> list[Tenant]:
#         return self.db.query(Tenant).filter(Tenant.status == 1).all()
    
    
#     def update(self, tenant: Tenant):
#         self.db.commit()
#         self.db.refresh(tenant)

#     def soft_delete(self, tenant: Tenant):
#         tenant.status = 0
#         self.db.commit()

    
from typing import List
from sqlalchemy.orm import Session, joinedload
from schemas.tenantDTO import CreateTenantDTO
from models.person import Tenant
from models.property import Property

class TenantRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: CreateTenantDTO) -> Tenant:
        tenant = Tenant(**data.dict())
        self.db.add(tenant)
        self.db.commit()
        self.db.refresh(tenant)
        return tenant

    def get_by_id(self, tenant_id: int) -> Tenant | None:
        return (
            self.db.query(Tenant)
            .filter(Tenant.id == tenant_id, Tenant.status == 1)
            .first()
        )

    def get_all(self) -> List[Tenant]:
        return (
            self.db.query(Tenant)
            .filter(Tenant.status == 1)
            .all()
        )
    
    def update(self, tenant: Tenant) -> None:
        self.db.commit()
        self.db.refresh(tenant)

    def soft_delete(self, tenant: Tenant) -> None:
        tenant.status = 0
        self.db.commit()