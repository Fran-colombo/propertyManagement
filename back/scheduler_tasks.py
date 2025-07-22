from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import get_db
from models.contract_period import ContractPeriod, PaymentStatusEnum

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

def init_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(update_periods_status, 'cron', hour=0)  
    scheduler.start()