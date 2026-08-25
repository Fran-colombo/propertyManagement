from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, get_db
from models.contract_period import ContractPeriod
from schemas.enums.enums import PaymentStatusEnum
from services.ipc_service import IpcServiceError
from services.index_service import IndexService


def update_periods_status():
    """Actualiza automáticamente los estados de los períodos"""
    db: Session = next(get_db())
    try:
        now = datetime.now().date()
        week_from_now = now + timedelta(days=7)

        upcoming_periods = db.query(ContractPeriod).filter(
            ContractPeriod.due_date.between(now, week_from_now),
            ContractPeriod.payment_status == PaymentStatusEnum.PENDIENTE
        ).all()

        for period in upcoming_periods:
            period.payment_status = PaymentStatusEnum.POR_VENCER
            db.add(period)

        expired_periods = db.query(ContractPeriod).filter(
            ContractPeriod.due_date < now,
            ContractPeriod.payment_status.in_([PaymentStatusEnum.PENDIENTE, PaymentStatusEnum.POR_VENCER])
        ).all()

        for period in expired_periods:
            period.payment_status = PaymentStatusEnum.VENCIDO
            db.add(period)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error en scheduled task: {str(e)}")
    finally:
        db.close()


def refresh_published_ipc():
    """
    Opción A: trae el IPC oficial y lo guarda en el catálogo.
    No modifica alquileres ni aplica índices a contratos.
    """
    # Ensure relationship mappers are configured before querying Index
    from models.contract_period import ContractPeriod  # noqa: F401

    db = SessionLocal()
    try:
        result = IndexService.refresh_from_official_api(db)
        print(
            f"[ipc-job] {result['action']} IPC={result['value']} period={result['period']}",
            flush=True,
        )
        return result
    except IpcServiceError as e:
        print(f"[ipc-job] No se pudo obtener IPC: {e}", flush=True)
        return None
    except Exception as e:
        db.rollback()
        print(f"[ipc-job] ERROR: {e}", flush=True)
        return None
    finally:
        db.close()


def init_scheduler():
    scheduler = BackgroundScheduler(timezone="America/Argentina/Buenos_Aires")
    scheduler.add_job(
        update_periods_status,
        "cron",
        hour=0,
        id="update_periods_status",
        replace_existing=True,
    )
    # INDEC suele publicar a mitad de mes: reintenta varios días.
    # Solo actualiza el catálogo; el alquiler se aplica a mano desde la app.
    scheduler.add_job(
        refresh_published_ipc,
        "cron",
        day="12-22",
        hour=10,
        minute=0,
        id="refresh_published_ipc",
        replace_existing=True,
    )
    scheduler.start()
    try:
        refresh_published_ipc()
    except Exception as e:
        print(f"[ipc-job] startup refresh skipped: {e}", flush=True)
