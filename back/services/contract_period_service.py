import calendar
from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case, or_, and_
from models.contract_period import ContractPeriod
from schemas.contract_periodDTO import ContractPeriodResponse
from schemas.enums.enums import PaymentStatusEnum
from typing import List, Optional
from models.contract import RentalContract

class ContractPeriodService:
    def __init__(self, db: Session):
        self.db = db

    def get_pending_periods(self, contract_id: int) -> List[ContractPeriodResponse]:
        today = date.today()

        try:
            contract_start = self.db.query(RentalContract).filter(RentalContract.id == contract_id).first().start_date
            first_day_of_contract_month = date(today.year, today.month, contract_start.day)
            last_day_of_contract_month = first_day_of_contract_month + relativedelta(months=1) - relativedelta(days=1)

            periods = self.db.query(ContractPeriod).filter(
                ContractPeriod.contract_id == contract_id,
                ContractPeriod.payment_status != PaymentStatusEnum.PAGADO,
                or_(
                    and_(
                        ContractPeriod.start_date >= first_day_of_contract_month,
                        ContractPeriod.end_date <= last_day_of_contract_month
                    ),
                    ContractPeriod.due_date < today
                )
            ).order_by(ContractPeriod.due_date).all()

            return [ContractPeriodResponse.from_orm(p) for p in periods]
            
        except Exception as e:
            print(f"Error in get_pending_periods for contract {contract_id}: {str(e)}")
            raise


    def get_current_period(self, contract_id: int) -> Optional[ContractPeriodResponse]:
        """Obtiene el periodo actual (donde la fecha actual está dentro del rango)"""
        today = date.today()
        
        try:
            period = self.db.query(ContractPeriod).filter(
                ContractPeriod.contract_id == contract_id,
                ContractPeriod.start_date <= today,
                ContractPeriod.end_date >= today
            ).first()

            return ContractPeriodResponse.from_orm(period) if period else None
            
        except Exception as e:
            print(f"Error in get_current_period for contract {contract_id}: {str(e)}")
            raise

    def get_overdue_periods(self, contract_id: int) -> List[ContractPeriodResponse]:
        """Obtiene exclusivamente periodos vencidos no pagados"""
        today = date.today()
        
        try:
            periods = self.db.query(ContractPeriod).filter(
                ContractPeriod.contract_id == contract_id,
                ContractPeriod.payment_status != PaymentStatusEnum.PAGADO,
                ContractPeriod.due_date < today
            ).order_by(ContractPeriod.end_date).all()

            return [ContractPeriodResponse.from_orm(p) for p in periods]
            
        except Exception as e:
            print(f"Error in get_overdue_periods for contract {contract_id}: {str(e)}")
            raise
 
    def get_all_pending_periods(self) -> List[ContractPeriod]:
        return (
            self.db.query(ContractPeriod)
            .options(
                joinedload(ContractPeriod.contract),
                joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.tenant),
                joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.property),
                joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.real_agency)
            )
            .filter(ContractPeriod.payment_status != "PAGADO", ContractPeriod.payment_status != "CONTRATO_TERMINADO")
            .all()
        )

    def get_all_relevant_periods(self) -> List[ContractPeriod]:
        today = date.today()
        first_day_of_month = date(today.year, today.month, 1)
        last_day_of_month = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
        
        return (
            self.db.query(ContractPeriod)
            .options(
                joinedload(ContractPeriod.contract),
                joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.tenant),
                joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.property),
                joinedload(ContractPeriod.contract)
                .joinedload(RentalContract.real_agency)
            )
            .filter(
                or_(
                    and_(
                        ContractPeriod.start_date <= last_day_of_month,
                        ContractPeriod.end_date >= first_day_of_month
                    ),
                    and_(
                        ContractPeriod.due_date < today,
                        ContractPeriod.payment_status != PaymentStatusEnum.PAGADO,
                        ContractPeriod.payment_status != PaymentStatusEnum.CONTRATO_TERMINADO
                    )
                )
            )
            .order_by(
                case(
                    (ContractPeriod.due_date < today, 0),
                    else_=1
                ),
                ContractPeriod.contract_id,
                ContractPeriod.due_date
            )
            .all()
        )

        
        
    def get_all_contract_periods(self, contract_id: int) -> List[ContractPeriod]:
        """
        Obtiene todos los períodos de un contrato, ordenados por fecha de inicio
        """
        periods = self.db.query(ContractPeriod)\
            .filter(ContractPeriod.contract_id == contract_id)\
            .order_by(ContractPeriod.start_date.asc())\
            .all()
        
        if not periods:
            raise ValueError(f"No se encontraron períodos para el contrato {contract_id}")
        
        return periods