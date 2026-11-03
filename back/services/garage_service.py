from fastapi import HTTPException
from sqlalchemy.orm import Session
from models.property_sale import PropertySale
from models.transaction_history import TransactionHistory
from repositories.garage_repository import GarageRepository, to_garage_read
from schemas.garageDTO import GarageCreate, GarageRead, GarageUpdate
from utils.contract_display import garage_display_label
from typing import List


def create_garage(db: Session, garage: GarageCreate) -> GarageRead:
    created = GarageRepository.create(db, garage)
    full = GarageRepository.get_garage_by_id(db, created.id)
    return to_garage_read(full)


def list_garages(db: Session, include_sold: bool = False) -> List[GarageRead]:
    return [
        to_garage_read(g)
        for g in GarageRepository.get_all_garages(db, include_sold=include_sold)
    ]


def get_garage(db: Session, garage_id: int) -> GarageRead:
    garage = GarageRepository.get_garage_by_id(db, garage_id)
    return to_garage_read(garage) if garage else None


def update_garage(db: Session, garage_id: int, data: GarageUpdate) -> GarageRead:
    garage = GarageRepository.get_garage_by_id(db, garage_id)
    if not garage:
        raise HTTPException(status_code=404, detail="Garage no encontrado")
    updates = data.model_dump(exclude_unset=True)
    if "number" in updates and not (updates["number"] or "").strip():
        raise HTTPException(status_code=400, detail="El número de garage no puede estar vacío")
    if "owner_id" in updates:
        owner = GarageRepository.get_active_owner(db, updates["owner_id"])
        if not owner:
            raise HTTPException(status_code=400, detail="El dueño indicado no existe")
    if "property_id" in updates and updates["property_id"] is not None:
        prop = GarageRepository.get_active_property(db, updates["property_id"])
        if not prop:
            raise HTTPException(status_code=400, detail="La propiedad indicada no existe")
    updated = GarageRepository.update(db, garage, data)
    if "number" in updates or "property_id" in updates:
        _refresh_sale_snapshots(db, updated)
    return to_garage_read(updated)


def delete_garage(db: Session, garage_id: int) -> dict:
    garage = GarageRepository.get_garage_by_id(db, garage_id)
    if not garage:
        raise HTTPException(status_code=404, detail="Garage no encontrado")
    if garage.rental_contract and garage.rental_contract.status == 1:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una cochera con contrato activo",
        )
    GarageRepository.soft_delete(db, garage)
    return {"message": "Cochera eliminada correctamente"}


def _refresh_sale_snapshots(db: Session, garage) -> None:
    sale_ids = [
        row[0]
        for row in db.query(PropertySale.id).filter(PropertySale.garage_id == garage.id).all()
    ]
    if not sale_ids:
        return
    db.query(TransactionHistory).filter(TransactionHistory.sale_id.in_(sale_ids)).update(
        {TransactionHistory.property_direction: garage_display_label(garage)},
        synchronize_session=False,
    )
    db.commit()
