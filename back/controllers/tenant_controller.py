from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from schemas.tenantDTO import CreateTenantDTO, TenantResponse, UpdateTenantDTO
from services.tenant_service import TenantService
from database import get_db

router = APIRouter(prefix="/tenants", tags=["Tenants"])

def get_service(db: Session = Depends(get_db)):
    return TenantService(db)

@router.post("/", response_model=TenantResponse)
def create_tenant(data: CreateTenantDTO, service: TenantService = Depends(get_service)):
    return service.create(data)

@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: int, service: TenantService = Depends(get_service)):
    return service.get_tenant(tenant_id)

@router.get("/", response_model=list[TenantResponse])
def get_all_tenants(service: TenantService = Depends(get_service)):
    return service.get_all_tenants()

@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(tenant_id: int, data: UpdateTenantDTO, service: TenantService = Depends(get_service)):
    return service.update_tenant(tenant_id, data)

@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: int, service: TenantService = Depends(get_service)):
    return service.delete_tenant(tenant_id)