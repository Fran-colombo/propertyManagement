from sqlalchemy.orm import Session
from models.contract import RentalContract
from models.contract_period import ContractPeriod
from schemas.contractDTO import CreateContractDTO
from datetime import date


class RentalContractRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, contract_data: CreateContractDTO) -> RentalContract:
        contract = RentalContract(**contract_data.dict())
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def get_by_id(self, contract_id: int) -> RentalContract | None:
        return self.db.query(RentalContract).filter(RentalContract.id == contract_id).first()

    def get_periods_by_contract(self, contract_id: int) -> list[ContractPeriod]:
        return self.db.query(ContractPeriod).filter(ContractPeriod.contract_id == contract_id).all()

    def create_periods(self, contract_id: int, periods_data: list[dict]) -> list[ContractPeriod]:
        periods = [ContractPeriod(contract_id=contract_id, **data) for data in periods_data]
        self.db.add_all(periods)
        self.db.commit()
        return periods

    def get_contracts_adjusting_next_month(self, from_date: date, to_date: date) -> list[RentalContract]:
        return (
            self.db.query(RentalContract)
            .join(ContractPeriod)
            .filter(ContractPeriod.end_date >= from_date)
            .filter(ContractPeriod.end_date <= to_date)
            .all()
        )
