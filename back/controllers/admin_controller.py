from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth_deps import require_admin
from database import get_db
from services import admin_crud_service as admin_crud

router = APIRouter(prefix="/admin", tags=["Sysadmin"])
db_dependency = Annotated[Session, Depends(get_db)]
admin_dependency = Annotated[dict, Depends(require_admin)]


@router.get("/tables")
def list_tables(_admin: admin_dependency):
    return admin_crud.list_tables()


@router.get("/tables/{table}")
def list_rows(
    table: str,
    db: db_dependency,
    _admin: admin_dependency,
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    return admin_crud.list_rows(db, table, q=q, page=page, page_size=page_size)


@router.get("/tables/{table}/{row_id}")
def get_row(table: str, row_id: str, db: db_dependency, _admin: admin_dependency):
    return admin_crud.get_row(db, table, row_id)


@router.post("/tables/{table}", status_code=201)
def create_row(
    table: str,
    payload: dict[str, Any],
    db: db_dependency,
    _admin: admin_dependency,
):
    return admin_crud.create_row(db, table, payload)


@router.patch("/tables/{table}/{row_id}")
def update_row(
    table: str,
    row_id: str,
    payload: dict[str, Any],
    db: db_dependency,
    _admin: admin_dependency,
):
    return admin_crud.update_row(db, table, row_id, payload)


@router.delete("/tables/{table}/{row_id}")
def delete_row(table: str, row_id: str, db: db_dependency, _admin: admin_dependency):
    return admin_crud.delete_row(db, table, row_id)
