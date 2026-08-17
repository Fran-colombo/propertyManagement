"""Fictional DEMO dataset. Never reads production SQLite. Used only in the DEMO image."""
from __future__ import annotations

from datetime import date

from dateutil.relativedelta import relativedelta
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from models.contract_period import ContractPeriod
from models.index import Index
from models.person import Owner, Tenant
from models.property import Garage, Property, RealAgency
from models.transactions import Transaction
from models.user_model import RoleEnum, User
from schemas.contractDTO import CreateContractDTO
from schemas.enums.enums import (
    AdjustmentFrequencyEnum,
    CurrencyEnum,
    IndexTypeEnum,
    PaymentStatusEnum,
)
from services.rental_contract_service import RentalContractService

bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_USER_EMAIL = "demo.user@example.com"
DEMO_USER_PASSWORD = "Demo123!"


def seed_if_empty(db: Session) -> None:
    if db.query(Owner).count() > 0:
        print("[demo-seed] Data already present, skip")
        return
    seed_demo(db)


def seed_demo(db: Session) -> None:
    print("[demo-seed] Loading fictional DEMO data")
    _ensure_demo_user(db)
    owners = _create_owners(db)
    tenants = _create_tenants(db)
    agency = _create_agency(db)
    props, garages = _create_units(db, owners)
    _create_indexes(db)
    db.commit()

    service = RentalContractService(db)
    today = date.today()

    active_start = (today.replace(day=1) - relativedelta(months=5))
    active_end = active_start + relativedelta(months=24)
    service.create_contract(
        CreateContractDTO(
            property_id=props[0].id,
            tenant_id=tenants[0].id,
            start_date=active_start,
            end_date=active_end,
            currency=CurrencyEnum.PESOS,
            base_rent=250000,
            real_agency_id=agency.id,
            index_type=IndexTypeEnum.IPC,
            frequency_adjustment=AdjustmentFrequencyEnum.TRIMESTRAL,
            includes_garage=True,
            garage_id=garages[0].id,
            fire_insurance=True,
            pays_epe=True,
            pays_tgi=True,
            pays_api=False,
            notes="Contrato DEMO activo — datos ficticios",
        )
    )

    garage_start = today.replace(day=1) - relativedelta(months=2)
    garage_end = garage_start + relativedelta(months=12)
    service.create_contract(
        CreateContractDTO(
            property_id=None,
            garage_id=garages[1].id,
            tenant_id=tenants[1].id,
            start_date=garage_start,
            end_date=garage_end,
            currency=CurrencyEnum.PESOS,
            base_rent=45000,
            index_type=None,
            frequency_adjustment=None,
            includes_garage=True,
            notes="Alquiler DEMO de garage — datos ficticios",
        )
    )

    ended_start = today.replace(day=1) - relativedelta(months=14)
    ended_end = ended_start + relativedelta(months=24)
    ended = service.create_contract(
        CreateContractDTO(
            property_id=props[1].id,
            tenant_id=tenants[2].id,
            start_date=ended_start,
            end_date=ended_end,
            currency=CurrencyEnum.PESOS,
            base_rent=180000,
            index_type=IndexTypeEnum.ICL,
            frequency_adjustment=AdjustmentFrequencyEnum.CUATRIMESTRAL,
            includes_garage=False,
            notes="Contrato DEMO finalizado — datos ficticios",
        )
    )

    leave_date = today - relativedelta(months=1)
    service.cancel_contract(
        ended.id,
        cancelled_by="INQUILINO",
        reason="Mudanza a otra ciudad (dato ficticio de DEMO)",
        effective_date=leave_date,
        settlement_amount=50000,
        settlement_direction="INQUILINO_A_PROPIETARIO",
        waive_remaining_rent=False,
    )

    _mark_past_periods_paid(db, today)
    db.commit()
    print("[demo-seed] Done")


def _ensure_demo_user(db: Session) -> None:
    existing = db.query(User).filter(User.email == DEMO_USER_EMAIL).first()
    if existing:
        existing.status = 1
        existing.password = bcrypt_context.hash(DEMO_USER_PASSWORD)
        existing.role = RoleEnum.user
        return
    db.add(
        User(
            name="Demo",
            surname="User",
            email=DEMO_USER_EMAIL,
            password=bcrypt_context.hash(DEMO_USER_PASSWORD),
            role=RoleEnum.user,
            status=1,
        )
    )


def _create_owners(db: Session) -> list[Owner]:
    rows = [
        Owner(
            name="Marta Pérez",
            phone="+54 11 5555-0101",
            email="marta.perez.demo@example.com",
            status=1,
        ),
        Owner(
            name="Ricardo Gómez",
            phone="+54 341 555-0202",
            email="ricardo.gomez.demo@example.com",
            status=1,
        ),
    ]
    db.add_all(rows)
    db.flush()
    return rows


def _create_tenants(db: Session) -> list[Tenant]:
    rows = [
        Tenant(
            name="Lucía Fernández",
            phone="+54 11 5555-1001",
            email="lucia.fernandez.demo@example.com",
            status=1,
        ),
        Tenant(
            name="Diego Morales",
            phone="+54 341 555-1002",
            email="diego.morales.demo@example.com",
            status=1,
        ),
        Tenant(
            name="Camila Soto",
            phone="+54 351 555-1003",
            email="camila.soto.demo@example.com",
            status=1,
        ),
    ]
    db.add_all(rows)
    db.flush()
    return rows


def _create_agency(db: Session) -> RealAgency:
    agency = RealAgency(
        name="Inmobiliaria Norte Demo",
        direction="Av. Demo 100, Rosario",
        status=1,
    )
    db.add(agency)
    db.flush()
    return agency


def _create_units(db: Session, owners: list[Owner]):
    apt_a = Property(
        owner_id=owners[0].id,
        direction="Calle Ficticia 123",
        floor="2",
        apartment="A",
        status=1,
    )
    apt_b = Property(
        owner_id=owners[1].id,
        direction="Av. Ejemplo 742",
        floor="1",
        apartment="B",
        status=1,
    )
    db.add_all([apt_a, apt_b])
    db.flush()

    g1 = Garage(
        number="8",
        owner_id=owners[0].id,
        property_id=apt_a.id,
        status=1,
    )
    g2 = Garage(
        number="12",
        owner_id=owners[1].id,
        property_id=None,
        status=1,
    )
    db.add_all([g1, g2])
    db.flush()
    return [apt_a, apt_b], [g1, g2]


def _create_indexes(db: Session) -> None:
    start = date.today().replace(day=1) - relativedelta(months=8)
    for i in range(8):
        month_start = start + relativedelta(months=i)
        month_end = month_start + relativedelta(months=1) - relativedelta(days=1)
        db.add(
            Index(
                type=IndexTypeEnum.IPC,
                date_from=month_start,
                date_to=month_end,
                value=round(3.1 + i * 0.15, 2),
            )
        )
        db.add(
            Index(
                type=IndexTypeEnum.ICL,
                date_from=month_start,
                date_to=month_end,
                value=round(2.4 + i * 0.12, 2),
            )
        )


def _mark_past_periods_paid(db: Session, today: date) -> None:
    periods = (
        db.query(ContractPeriod)
        .filter(
            ContractPeriod.end_date < today,
            ContractPeriod.payment_status == PaymentStatusEnum.PENDIENTE,
        )
        .all()
    )
    for period in periods:
        amount = period.total_amount or period.indexed_amount or 0
        period.amount_paid = amount
        period.payment_status = PaymentStatusEnum.PAGADO
        period.payment_date = period.due_date
        period.payment_method = "TRANSFERENCIA"
        period.payment_reference = "DEMO-PAGO"
        db.add(
            Transaction(
                period_id=period.id,
                amount=amount,
                date=period.due_date,
                method="TRANSFERENCIA",
                notes="Pago ficticio de DEMO",
                remaining_amount=0,
            )
        )
