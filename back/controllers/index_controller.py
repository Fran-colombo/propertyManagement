from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from database import get_db
from schemas.updateIndexDTO import CreateIndex, UpdateIndexDTO
from services.index_service import IndexService
from services.ipc_service import get_ipc_for_date, get_latest_ipc, IpcServiceError

router = APIRouter(prefix="/indices", tags=["Indices"])


@router.get("/ipc")
def get_ipc(
    date_param: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """
    IPC-GBA Nivel General.
    Intenta la API oficial; si falla, usa el valor del catálogo
    (actualizado por el job mensual).
    """
    try:
        if date_param:
            result = get_ipc_for_date(date_param)
        else:
            result = get_latest_ipc()
        return {**result, "source": "api"}
    except IpcServiceError as e:
        cached = IndexService.get_latest_catalog_ipc(db)
        if cached and not date_param:
            return cached
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/ipc/refresh")
def refresh_ipc(db: Session = Depends(get_db)):
    """Manual trigger: fetch official IPC into catalog (does not apply to contracts)."""
    from models.contract_period import ContractPeriod  # noqa: F401

    try:
        result = IndexService.refresh_from_official_api(db)
        return {
            **result,
            "message": "IPC actualizado en el catálogo. Los alquileres no se modificaron.",
        }
    except IpcServiceError as e:
        cached = IndexService.get_latest_catalog_ipc(db)
        detail = str(e)
        if cached:
            detail += f". Último en catálogo: {cached['value']} ({cached['period']})"
        raise HTTPException(status_code=502, detail=detail) from e


@router.post("/", status_code=201)
def create_index(dto: CreateIndex, db: Session = Depends(get_db)):
    try:
        return IndexService.create(db, dto)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/", status_code=200)
def update_index(dto: UpdateIndexDTO, db: Session = Depends(get_db)):
    try:
        return IndexService.update(db, dto)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
def get_indexes(db: Session = Depends(get_db)):
    return IndexService.get_indexes(db)
