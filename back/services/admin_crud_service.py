"""Generic table CRUD for the sysadmin panel."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, Float, Integer, String, Text, inspect, or_
from sqlalchemy.orm import Session, joinedload

from models.base import Base
from models.user_model import RoleEnum, User
from services.user_service import _active_admin_count, _role_value, bcrypt_context
from utils.contract_display import (
    contract_location_label,
    garage_display_label,
    property_display_label,
    sale_target_label,
)

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

COLUMN_LABELS = {
    "id": "ID",
    "name": "Nombre",
    "surname": "Apellido",
    "email": "Email",
    "phone": "Teléfono",
    "direction": "Dirección",
    "floor": "Piso",
    "apartment": "Depto",
    "number": "Número",
    "tenant_id": "Inquilino",
    "tenant_name": "Inquilino",
    "property_id": "Propiedad",
    "property_address": "Propiedad",
    "garage_id": "Cochera",
    "owner_id": "Dueño",
    "owner_name": "Dueño",
    "real_agency_id": "Inmobiliaria",
    "contract_id": "Contrato",
    "rental_contract_id": "Contrato",
    "period_id": "Período",
    "index_id": "Índice",
    "index_type": "Índice",
    "sale_id": "Venta",
    "seller_owner_id": "Vendedor",
    "buyer_owner_id": "Comprador",
    "buyer_name": "Comprador",
    "transaction_id": "Transacción",
    "start_date": "Inicio",
    "end_date": "Fin",
    "due_date": "Vencimiento",
    "date": "Fecha",
    "date_from": "Desde",
    "date_to": "Hasta",
    "payment_date": "Fecha de pago",
    "sale_date": "Fecha de venta",
    "paid_at": "Pagado el",
    "created_at": "Creado",
    "base_rent": "Alquiler base",
    "indexed_amount": "Indexado",
    "total_amount": "Total",
    "amount": "Monto",
    "amount_paid": "Pagado",
    "period_total_amount": "Total período",
    "period_amount_paid": "Pagado período",
    "epe_amount": "EPE",
    "tgi_amount": "TGI",
    "api_amount": "API",
    "fire_proof_amount": "Seguro incendio",
    "fire_insurance_amount": "Seguro incendio",
    "late_fee_amount": "Recargo",
    "settlement_amount": "Acuerdo",
    "payment_status": "Estado",
    "period_payment_status": "Estado",
    "status": "Estado",
    "management_status": "Gestión",
    "currency": "Moneda",
    "notes": "Notas",
    "reason": "Motivo",
    "cancellation_reason": "Motivo de baja",
    "cancelled_by": "Baja por",
    "cancelled": "Cancelado",
    "payment_method": "Medio de pago",
    "method": "Medio",
    "payment_reference": "Referencia",
    "document_path": "Archivo",
    "receipt_path": "Comprobante",
    "tgi_account": "Cuenta TGI",
    "tgi_code": "Código TGI",
    "tgi_mode": "Modo TGI",
    "tgi_detail": "Detalle TGI",
    "tgi_debt_plan": "Plan TGI",
    "pays_epe": "Paga EPE",
    "pays_tgi": "Paga TGI",
    "pays_api": "Paga API",
    "fire_insurance": "Seguro incendio",
    "includes_garage": "Incluye cochera",
    "is_prorated": "Proporcional",
    "proration_note": "Nota proporcional",
    "termination_note": "Nota de baja",
    "waive_remaining_rent": "No cobrar hasta la salida",
    "waive_current_month": "No cobrar mes de baja",
    "settlement_direction": "Dirección del acuerdo",
    "effective_date": "Fecha de baja",
    "frequency_adjustment": "Frecuencia",
    "base_index_value": "Índice base",
    "last_index_value": "Último índice",
    "applied_index_value": "Índice aplicado",
    "value": "Valor",
    "type": "Tipo",
    "kind": "Tipo",
    "role": "Rol",
    "password": "Contraseña",
    "key": "Clave",
    "received_by": "Recibido por",
    "remitted_to_owner": "Remitido",
    "keep_managing": "Seguir administrando",
    "total_amount": "Total",
}

SHORTCUTS = ("rental_contracts", "contract_periods")
HIDDEN_READ_COLUMNS = {"password"}
SEARCH_RELATED_COLUMNS = (
    "name",
    "surname",
    "email",
    "direction",
    "number",
    "apartment",
    "tenant_name",
    "property_address",
    "buyer_name",
    "owner_name",
)
ID_TABLE_HINTS = {
    "tenant_id": "tenants",
    "property_id": "properties",
    "garage_id": "garages",
    "owner_id": "owners",
    "contract_id": "rental_contracts",
    "rental_contract_id": "rental_contracts",
    "period_id": "contract_periods",
    "transaction_id": "transactions",
    "sale_id": "property_sales",
    "index_id": "indices",
    "real_agency_id": "real_agencies",
    "seller_owner_id": "owners",
    "buyer_owner_id": "owners",
}
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


def _fk_table(column) -> Optional[str]:
    try:
        fks = list(getattr(column, "foreign_keys", None) or [])
        if fks:
            return fks[0].column.table.name
    except Exception:
        pass
    return ID_TABLE_HINTS.get(column.name)


def _column_label(column) -> str:
    return COLUMN_LABELS.get(column.name, column.name.replace("_", " "))


def _fmt_date(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _row_label(row) -> str:
    if row is None:
        return ""
    if isinstance(row, Tenant) or isinstance(row, Owner) or isinstance(row, RealAgency):
        return (row.name or "").strip()
    if isinstance(row, User):
        full = f"{row.name or ''} {row.surname or ''}".strip()
        return full or (row.email or "")
    if isinstance(row, Property):
        return property_display_label(row)
    if isinstance(row, Garage):
        return garage_display_label(row)
    if isinstance(row, RentalContract):
        tenant = getattr(row, "tenant", None)
        who = (tenant.name if tenant else "") or "Sin inquilino"
        where = contract_location_label(row)
        when = _fmt_date(row.start_date)
        return " · ".join(part for part in (who, where, when) if part)
    if isinstance(row, ContractPeriod):
        contract = getattr(row, "contract", None)
        base = _row_label(contract) if contract else ""
        span = " – ".join(part for part in (_fmt_date(row.start_date), _fmt_date(row.end_date)) if part)
        return " · ".join(part for part in (base, span) if part)
    if isinstance(row, ContractTermination):
        return " · ".join(
            part
            for part in (_row_label(getattr(row, "contract", None)), _fmt_date(row.effective_date))
            if part
        )
    if isinstance(row, ContractHistory):
        who = row.tenant_name or _row_label(getattr(row, "tenant", None))
        where = row.property_address or _row_label(getattr(row, "property", None))
        return " · ".join(part for part in (who, where, _fmt_date(row.start_date)) if part)
    if isinstance(row, Index):
        kind = row.type.value if hasattr(row.type, "value") else (row.type or "Índice")
        return " · ".join(part for part in (str(kind), _fmt_date(row.date_from)) if part)
    if isinstance(row, Transaction):
        period = getattr(row, "period", None)
        amount = f"${row.amount:,.2f}" if row.amount is not None else ""
        return " · ".join(part for part in (_row_label(period), amount, _fmt_date(row.date)) if part)
    if isinstance(row, TransactionHistory):
        who = row.tenant_name or ""
        where = row.property_direction or ""
        return " · ".join(part for part in (who, where, _fmt_date(row.date)) if part)
    if isinstance(row, PropertySale):
        who = row.buyer_name or _row_label(getattr(row, "buyer", None))
        return " · ".join(
            part for part in (sale_target_label(row), who, _fmt_date(row.sale_date)) if part
        )
    if isinstance(row, PropertySalePayment):
        sale = getattr(row, "sale", None)
        return " · ".join(part for part in (_row_label(sale), _fmt_date(row.due_date)) if part)
    if isinstance(row, AppSetting):
        return str(row.key or "")
    if isinstance(row, ReminderLog):
        return " · ".join(part for part in (row.kind or "", _fmt_date(row.sent_on)) if part)
    for attr in ("name", "direction", "number", "email", "key", "buyer_name", "tenant_name"):
        value = getattr(row, attr, None)
        if value:
            return str(value)
    return ""


def _related_via_fk(row, column):
    mapper = inspect(type(row))
    for rel in mapper.relationships:
        local = list(getattr(rel, "local_columns", []) or [])
        if column in local:
            return getattr(row, rel.key, None)
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


def _make_related_loader(db: Session):
    cache = {}

    def load(table_name: str, ident):
        if ident in (None, ""):
            return None
        key = (table_name, ident)
        if key in cache:
            return cache[key]
        target = _models_by_table().get(table_name)
        if target is None:
            cache[key] = None
            return None
        pks = _pk_columns(target)
        if len(pks) != 1:
            cache[key] = None
            return None
        query = db.query(target).filter(pks[0] == ident)
        opts = _eager_options(target)
        if opts:
            query = query.options(*opts)
        cache[key] = query.first()
        return cache[key]

    return load


def _row_to_dict(model, row, loader=None) -> dict:
    data = {"_label": _row_label(row)}
    mapper = inspect(model)
    for column in mapper.columns:
        raw = getattr(row, column.name, None)
        data[column.name] = _serialize_value(column, raw)
        fk = _fk_table(column)
        if not fk:
            continue
        related = _related_via_fk(row, column)
        if related is None and loader is not None:
            related = loader(fk, raw)
        data[f"{column.name}__label"] = _row_label(related) if related is not None else ""
    return data


LABEL_RELS = {
    "tenant",
    "property",
    "garage",
    "owner",
    "buyer",
    "seller",
    "contract",
    "period",
    "index",
    "real_agency",
    "sale",
}
NESTED_LABEL_RELS = ("tenant", "property", "garage", "owner", "buyer", "seller", "contract")


def _eager_options(model):
    opts = []
    mapper = inspect(model)
    for rel in mapper.relationships:
        if rel.uselist or rel.key not in LABEL_RELS:
            continue
        opts.append(joinedload(getattr(model, rel.key)))
        target = rel.mapper.class_
        nested = inspect(target)
        for child in nested.relationships:
            if child.uselist or child.key not in NESTED_LABEL_RELS:
                continue
            opts.append(joinedload(getattr(model, rel.key)).joinedload(getattr(target, child.key)))
    return opts


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
        return date.fromisoformat(str(value)[:10])
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
    query = db.query(model)
    opts = _eager_options(model)
    if opts:
        query = query.options(*opts)
    row = query.filter(getattr(model, pk.name) == ident).first()
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


def _column_info(column) -> dict:
    info = {
        "name": column.name,
        "label": _column_label(column),
        "kind": _column_kind(column),
        "nullable": bool(column.nullable),
        "primary_key": bool(column.primary_key),
        "hidden": column.name in HIDDEN_READ_COLUMNS,
        "fk": _fk_table(column),
        "hide_in_grid": bool(column.primary_key),
        "hide_in_form": bool(column.primary_key and _column_kind(column) == "integer"),
    }
    options = _enum_options(column)
    if options:
        info["options"] = options
    return info


def list_tables() -> dict:
    models = _models_by_table()
    tables = []
    for name, model in sorted(models.items(), key=lambda item: TABLE_LABELS.get(item[0], item[0])):
        columns = [_column_info(column) for column in inspect(model).columns]
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


def _search_filters(db: Session, model, term: str):
    filters = []
    for column in inspect(model).columns:
        if column.name in HIDDEN_READ_COLUMNS:
            continue
        kind = _column_kind(column)
        if kind in ("string", "text"):
            filters.append(column.ilike(f"%{term}%"))
        fk = _fk_table(column)
        if not fk:
            continue
        related = _models_by_table().get(fk)
        if related is None:
            continue
        related_pk = _pk_columns(related)
        if len(related_pk) != 1:
            continue
        name_filters = []
        for rel_col in inspect(related).columns:
            if rel_col.name in SEARCH_RELATED_COLUMNS:
                name_filters.append(rel_col.ilike(f"%{term}%"))
        if not name_filters:
            continue
        sub = db.query(related_pk[0]).filter(or_(*name_filters))
        filters.append(column.in_(sub))
    return filters


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
        filters = _search_filters(db, model, term)
        if filters:
            query = query.filter(or_(*filters))
    total = query.count()
    pks = _pk_columns(model)
    order = pks[0] if pks else list(inspect(model).columns)[0]
    fetch = query
    opts = _eager_options(model)
    if opts:
        fetch = fetch.options(*opts)
    rows = (
        fetch.order_by(order.desc() if _column_kind(order) == "integer" else order.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    loader = _make_related_loader(db)
    return {
        "table": table,
        "label": TABLE_LABELS.get(table, table),
        "total": total,
        "page": page,
        "page_size": page_size,
        "rows": [_row_to_dict(model, row, loader) for row in rows],
    }


def get_row(db: Session, table: str, row_id: str) -> dict:
    model = _model(table)
    return _row_to_dict(model, _find_row(db, model, row_id), _make_related_loader(db))


def fk_choices(db: Session, table: str) -> dict:
    model = _model(table)
    choices = {}
    for column in inspect(model).columns:
        target_name = _fk_table(column)
        if not target_name:
            continue
        target = _models_by_table().get(target_name)
        if target is None:
            continue
        opts = _eager_options(target)
        query = db.query(target)
        if opts:
            query = query.options(*opts)
        items = []
        for row in query.limit(500).all():
            pks = _pk_columns(target)
            ident = getattr(row, pks[0].name) if pks else None
            items.append({"id": ident, "label": _row_label(row) or str(ident)})
        items.sort(key=lambda item: (item["label"] or "").lower())
        choices[column.name] = items
    return choices


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
    pk = _pk_columns(model)[0]
    return _row_to_dict(model, _find_row(db, model, str(getattr(row, pk.name))), _make_related_loader(db))


def update_row(db: Session, table: str, row_id: str, payload: dict) -> dict:
    model = _model(table)
    row = _find_row(db, model, row_id)
    _guard_last_admin(db, row, payload, deleting=False)
    _apply_payload(model, row, payload, creating=False)
    db.commit()
    db.refresh(row)
    return _row_to_dict(model, _find_row(db, model, row_id), _make_related_loader(db))


def delete_row(db: Session, table: str, row_id: str) -> dict:
    model = _model(table)
    row = _find_row(db, model, row_id)
    _guard_last_admin(db, row, deleting=True)
    db.delete(row)
    db.commit()
    return {"ok": True, "id": row_id}
