import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models.index import Index
from schemas.updateIndexDTO import CreateIndex, UpdateIndexDTO
from fastapi import HTTPException


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
        """Update the catalog index value only. Does not modify contracts.
        Use POST /contracts/{id}/apply-index to adjust a specific contract.
        """
        index = db.query(Index).filter(Index.type == dto.type).first()
        if not index:
            raise HTTPException(status_code=404, detail="Index not found")

        index.value = dto.value
        db.commit()
        db.refresh(index)
        return index

    @staticmethod
    def get_applicable_index(db: Session, index_type: str, date: datetime.date) -> Optional[Index]:
        return db.query(Index).filter(
            Index.type == index_type,
            Index.date_from <= date
        ).order_by(Index.date_to.desc()).first()

    def get_indexes(db: Session):
        indexes = db.query(Index).all()
        return indexes
