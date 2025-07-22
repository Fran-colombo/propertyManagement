from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session
from schemas.updateIndexDTO import CreateIndex, UpdateIndexDTO
from models.index import Index

class IndexRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: CreateIndex) -> Index:
        index = Index(**data.dict())
        self.db.add(index)
        self.db.commit()
        self.db.refresh(index)
        return index
    
    def update(self, data: UpdateIndexDTO) -> Index:
        index = self.db.query(Index).filter(Index.type == data.type).first()
        if not index:
            raise HTTPException(status_code=404, detail="Index not found")
        index.value = data.value
        self.db.commit()
        self.db.refresh(index)
        return index

    def get_all_by_type(self, type: str) -> list[Index]:
        return self.db.query(Index).filter(Index.type == type).all()

    def get_latest_by_type(self, type: str) -> Index | None:
        return (
            self.db.query(Index)
            .filter(Index.type == type)
            .order_by(Index.date_from.desc())
            .first()
        )

    def get_by_type_and_date(self, type: str, target_date: date) -> Index | None:
        return (
            self.db.query(Index)
            .filter(
                Index.type == type,
                Index.date_from <= target_date,
                Index.date_to >= target_date
            )
            .first()
        )
