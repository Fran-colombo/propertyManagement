import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models.contract import RentalContract
from schemas.enums.enums import CurrencyEnum
from models.index import Index
from schemas.updateIndexDTO import CreateIndex, UpdateIndexDTO
from fastapi import HTTPException

import datetime

class IndexService:
    @staticmethod
    def create(db: Session, dto: CreateIndex) -> Index:
        today = datetime.date.today()
        index = Index(
            type=dto.type,
            value=dto.value,
            date_from=today,
            date_to=None  
        )
        db.add(index)
        db.commit()
        db.refresh(index)
        return index

    @staticmethod
    def update(db: Session, dto: UpdateIndexDTO) -> Index:
        index = db.query(Index).filter(Index.type == dto.type).first()
        if not index:
            raise HTTPException(status_code=404, detail="Index not found")

        index.value = dto.value
        db.commit()
        db.refresh(index)

        today = datetime.date.today()

        contracts = db.query(RentalContract).filter(
            RentalContract.currency == CurrencyEnum.PESOS,
            RentalContract.index_type == dto.type
        ).all()

        for contract in contracts:
            base_amount = contract.base_rent
            current_amount = base_amount
            contract_start = contract.start_date

            for period in contract.periods:
                if period.payment_status == 'PAGADO':
                    current_amount = period.indexed_amount or current_amount
                    continue  

                months = (period.start_date.year - contract_start.year) * 12 + \
                        (period.start_date.month - contract_start.month)

                apply = False
                if contract.frequency_adjustment == 'TRIMESTRAL' and months % 3 == 0:
                    apply = True
                elif contract.frequency_adjustment == 'CUATRIMESTRAL' and months % 4 == 0:
                    apply = True

                if apply:
                    current_amount = round(current_amount * (1 + dto.value / 100), 2)

                period.indexed_amount = current_amount
                period.total_amount = current_amount
                period.applied_index_value = dto.value if apply else None
                period.index_id = index.id if apply else None

        db.commit()
        return index


    @staticmethod
    def get_applicable_index(db: Session, index_type: str, date: datetime.date) -> Optional[Index]:
        return db.query(Index).filter(
            Index.type == index_type,
            Index.date_from <= date
        ).order_by(Index.date_to.desc()).first()
    
    def get_indexes(db:Session):
        indexes = db.query(Index).all()
        return indexes
