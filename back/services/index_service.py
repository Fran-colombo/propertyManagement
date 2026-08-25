import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models.index import Index
from schemas.updateIndexDTO import CreateIndex, UpdateIndexDTO
from schemas.enums.enums import IndexTypeEnum
from fastapi import HTTPException
from services.ipc_service import get_latest_ipc


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

    @staticmethod
    def get_latest_catalog_ipc(db: Session) -> Optional[Dict[str, Any]]:
        """Latest IPC row stored by the monthly refresh job (or manual upsert)."""
        row = (
            db.query(Index)
            .filter(Index.type == IndexTypeEnum.IPC)
            .order_by(Index.date_from.desc(), Index.id.desc())
            .first()
        )
        if not row:
            return None
        period = row.date_from.isoformat() if row.date_from else None
        return {
            "value": float(row.value),
            "period": period,
            "series_id": "103.1_I2N_2016_M_19",
            "label": "IPC-GBA Nivel General",
            "source": "catalog",
        }

    @staticmethod
    def upsert_published_ipc(
        db: Session, value: float, period: datetime.date
    ) -> Dict[str, Any]:
        """
        Store the official monthly IPC in the catalog without touching contracts.
        If the same period already exists, update the value; otherwise insert
        and close the previous open IPC row.
        """
        period = datetime.date(period.year, period.month, 1)
        existing = (
            db.query(Index)
            .filter(
                Index.type == IndexTypeEnum.IPC,
                Index.date_from == period,
            )
            .first()
        )
        if existing:
            changed = abs(float(existing.value) - float(value)) > 1e-6
            existing.value = float(value)
            existing.date_to = None
            db.commit()
            db.refresh(existing)
            return {
                "action": "updated" if changed else "unchanged",
                "value": float(existing.value),
                "period": period.isoformat(),
            }

        open_rows = (
            db.query(Index)
            .filter(
                Index.type == IndexTypeEnum.IPC,
                Index.date_to.is_(None),
            )
            .all()
        )
        day_before = period - datetime.timedelta(days=1)
        for row in open_rows:
            row.date_to = day_before

        created = Index(
            type=IndexTypeEnum.IPC,
            value=float(value),
            date_from=period,
            date_to=None,
        )
        db.add(created)
        db.commit()
        db.refresh(created)
        return {
            "action": "created",
            "value": float(created.value),
            "period": period.isoformat(),
        }

    @staticmethod
    def refresh_from_official_api(db: Session) -> Dict[str, Any]:
        """Fetch official IPC and store in catalog. Does not touch contracts."""
        ipc = get_latest_ipc()
        period = datetime.date.fromisoformat(ipc["period"])
        result = IndexService.upsert_published_ipc(db, ipc["value"], period)
        return {
            **result,
            "label": ipc.get("label"),
            "series_id": ipc.get("series_id"),
        }
