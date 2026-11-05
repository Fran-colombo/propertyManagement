"""Generic table CRUD for the sysadmin panel."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, Float, Integer, String, Text, inspect, or_
from sqlalchemy.orm import Session

from models.base import Base
from models.user_model import RoleEnum, User
from services.user_service import _active_admin_count, _role_value, bcrypt_context

# Ensure mappers are registered.
from models.property import Property, Garage, RealAgency  # noqa: F401
from models.person import Tenant, Owner  # noqa: F401
from models.contract import RentalContract  # noqa: F401
from models.contract_period import ContractPeriod  # noqa: F401
from models.contract_termination import ContractTermination  # noqa: F401
from models.contract_history import ContractHistory  # noqa: F401
from models.index import Index  # noqa: F401
from models.transactions import Transaction  # noqa: F401
from models.transaction_history import TransactionHistory  # noqa: F401
from models.property_sale import PropertySale, PropertySalePayment  # noqa: F401
from models.reminder_log import ReminderLog  # noqa: F401
from models.app_setting import AppSetting  # noqa: F401
from models.user_model import User as _User  # noqa: F401

TABLE_LABELS = {
    "rental_contracts": "Contratos",
    "contract_periods": "Períodos",
    "contract_terminations": "Bajas",
    "all_contracts": "Historial de contratos",
    "tenants": "Inquilinos",
    "owners": "Dueños",
    "properties": "Propiedades",
    "garages": "Cocheras",
    "real_agencies": "Inmobiliarias",
    "transactions": "Transacciones",
    "transaction_history": "Historial de transacciones",
    "property_sales": "Ventas",
    "property_sale_payments": "Cuotas de venta",
    "indices": "Índices",
    "users": "Usuarios",
    "app_settings": "Configuración",
    "reminder_logs": "Recordatorios",
}

SHORTCUTS = ("rental_contracts", "contract_periods")
HIDDEN_READ_COLUMNS = {"password"}
PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 200


def _models_by_table() -> dict[str, type]:
    mapping = {}
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        table = getattr(cls, "__tablename__", None)
        if table:
            mapping[table] = cls
    return mapping


def _model(name: str):
    model = _models_by_table().get(name)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Tabla no encontrada: {name}")
    return model


def _pk_columns(model):
    return list(inspect(model).primary_key)


def _column_kind(column) -> str:
    col_type = column.type
    if isinstance(col_type, Boolean):
        return "boolean"
    if isinstance(col_type, DateTime):
        return "datetime"
    if isinstance(col_type, Date):
        return "date"
    if isinstance(col_type, Integer):
        return "integer"
    if isinstance(col_type, Float):
        return "number"
    if isinstance(col_type, SAEnum) or getattr(col_type, "enum_class", None):
        return "enum"
    if isinstance(col_type, Text):
        return "text"
    if isinstance(col_type, String):
        return "string"
    return "string"


def _enum_options(column) -> Optional[list[str]]:
    col_type = column.type
    enum_cls = getattr(col_type, "enum_class", None)
    if enum_cls is not None:
        return [item.value if hasattr(item, "value") else str(item) for item in enum_cls]
    enums = getattr(col_type, "enums", None)
    if enums:
        return list(enums)
    return None


def _serialize_value(column, value):
    if column.name in HIDDEN_READ_COLUMNS:
        return None if value in (None, "") else "••••"
    if value is None:
        return None
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat(sep=" ", timespec="seconds")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return value
    return value


def _row_to_dict(model, row) -> dict:
    data = {}
    for column in inspect(model).columns:
        data[column.name] = _serialize_value(column, getattr(row, column.name, None))
    return data


def _coerce(column, value):
    if value is None or value == "":
        return None
    kind = _column_kind(column)
    if kind == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        return str(value).strip().lower() in ("1", "true", "t", "yes", "si", "sí")
    if kind == "integer":
        return int(value)
    if kind == "number":
        return float(value)
    if kind == "date":
        text = str(value)[:10]
        return date.fromisoformat(text)
    if kind == "datetime":
        text = str(value).replace("T", " ")
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return datetime.fromisoformat(text[:19])
    if kind == "enum":
        enum_cls = getattr(column.type, "enum_class", None)
        if enum_cls is not None:
            try:
                return enum_cls(value)
            except Exception:
                for item in enum_cls:
                    if str(getattr(item, "value", item)) == str(value) or item.name == str(value):
                        return item
                raise HTTPException(
                    status_code=400,
                    detail=f"Valor inválido para {column.name}: {value}",
                )
        return str(value)
    return value


def _find_row(db: Session, model, row_id: str):
    pks = _pk_columns(model)
    if len(pks) != 1:
        raise HTTPException(status_code=400, detail="Esta tabla no se puede editar por un solo id")
    pk = pks[0]
    ident: Any = row_id
    if _column_kind(pk) == "integer":
        try:
            ident = int(row_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Id inválido")
    row = db.query(model).filter(getattr(model, pk.name) == ident).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fila no encontrada")
    return row


def _guard_last_admin(db: Session, row, payload: Optional[dict] = None, deleting: bool = False):
    if not isinstance(row, User):
        return
    if _role_value(row) != RoleEnum.admin.value or row.status != 1:
        return
    if deleting:
        if _active_admin_count(db) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Tiene que quedar al menos un administrador activo",
            )
        return
    payload = payload or {}
    new_role = payload.get("role", _role_value(row))
    new_status = payload.get("status", row.status)
    if str(new_role) != RoleEnum.admin.value or int(new_status or 0) != 1:
        if _active_admin_count(db) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Tiene que quedar al menos un administrador activo",
            )


def list_tables() -> dict:
    models = _models_by_table()
    tables = []
    for name, model in sorted(models.items(), key=lambda item: TABLE_LABELS.get(item[0], item[0])):
        columns = []
        for column in inspect(model).columns:
            info = {
                "name": column.name,
                "kind": _column_kind(column),
                "nullable": bool(column.nullable),
                "primary_key": bool(column.primary_key),
                "hidden": column.name in HIDDEN_READ_COLUMNS,
            }
            options = _enum_options(column)
            if options:
                info["options"] = options
            columns.append(info)
        pks = [col.name for col in _pk_columns(model)]
        tables.append(
            {
                "name": name,
                "label": TABLE_LABELS.get(name, name),
                "shortcut": name in SHORTCUTS,
                "pk": pks,
                "columns": columns,
            }
        )
    shortcuts = [table for table in tables if table["shortcut"]]
    rest = [table for table in tables if not table["shortcut"]]
    return {"shortcuts": shortcuts, "tables": shortcuts + rest}


def list_rows(
    db: Session,
    table: str,
    *,
    q: str = "",
    page: int = 1,
    page_size: int = PAGE_SIZE_DEFAULT,
) -> dict:
    model = _model(table)
    page = max(1, int(page or 1))
    page_size = min(PAGE_SIZE_MAX, max(1, int(page_size or PAGE_SIZE_DEFAULT)))
    query = db.query(model)
    term = (q or "").strip()
    if term:
        filters = []
        for column in inspect(model).columns:
            if column.name in HIDDEN_READ_COLUMNS:
                continue
            kind = _column_kind(column)
            if kind in ("string", "text"):
                filters.append(column.ilike(f"%{term}%"))
            elif kind in ("integer", "number") and term.replace(".", "", 1).isdigit():
                try:
                    filters.append(column == _coerce(column, term))
                except Exception:
                    pass
        if filters:
            query = query.filter(or_(*filters))
    total = query.count()
    pks = _pk_columns(model)
    order = pks[0] if pks else inspect(model).columns[0]
    rows = (
        query.order_by(order.desc() if _column_kind(order) == "integer" else order.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "table": table,
        "label": TABLE_LABELS.get(table, table),
        "total": total,
        "page": page,
        "page_size": page_size,
        "rows": [_row_to_dict(model, row) for row in rows],
    }


def get_row(db: Session, table: str, row_id: str) -> dict:
    model = _model(table)
    return _row_to_dict(model, _find_row(db, model, row_id))


def _apply_payload(model, row, payload: dict, *, creating: bool):
    columns = {col.name: col for col in inspect(model).columns}
    for key, value in (payload or {}).items():
        if key not in columns:
            continue
        column = columns[key]
        if column.primary_key and not creating:
            continue
        if key == "password":
            if value in (None, "", "••••"):
                continue
            setattr(row, key, bcrypt_context.hash(str(value)))
            continue
        setattr(row, key, _coerce(column, value))


def create_row(db: Session, table: str, payload: dict) -> dict:
    model = _model(table)
    row = model()
    _apply_payload(model, row, payload, creating=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_dict(model, row)


def update_row(db: Session, table: str, row_id: str, payload: dict) -> dict:
    model = _model(table)
    row = _find_row(db, model, row_id)
    _guard_last_admin(db, row, payload, deleting=False)
    _apply_payload(model, row, payload, creating=False)
    db.commit()
    db.refresh(row)
    return _row_to_dict(model, row)


def delete_row(db: Session, table: str, row_id: str) -> dict:
    model = _model(table)
    row = _find_row(db, model, row_id)
    _guard_last_admin(db, row, deleting=True)
    db.delete(row)
    db.commit()
    return {"ok": True, "id": row_id}
