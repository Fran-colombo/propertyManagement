from fastapi import HTTPException
from sqlalchemy.orm import Session
from models.person import Tenant
from schemas.tenantDTO import CreateTenantDTO, UpdateTenantDTO
from repositories.tenant_repository import TenantRepository

class TenantService:
    def __init__(self, db: Session):
        self.repo = TenantRepository(db)

    def create(self, data: CreateTenantDTO) -> Tenant:
        return self.repo.create(data)
    
    def get_tenant(self, tenant_id: int) -> Tenant:
        tenant = self.repo.get_by_id(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return tenant
    
    def get_all_tenants(self) -> list[Tenant]:
        return self.repo.get_all()
    
    def update_tenant(self, tenant_id: int, data: UpdateTenantDTO) -> Tenant:
        tenant = self.repo.get_by_id(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tenant, key, value)
            
        self.repo.update(tenant)
        return tenant

    def delete_tenant(self, tenant_id: int) -> dict:
        tenant = self.repo.get_by_id(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        self.repo.soft_delete(tenant)
        return {"message": "Tenant deleted successfully"}

      
