from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth_deps import get_current_user
from database import get_db
from services.reminder_service import preview_due_reminders, send_due_reminders

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/rent-reminders/preview")
def preview_rent_reminders(
    days: Optional[int] = Query(None, ge=0, le=31),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return preview_due_reminders(db, days=days)


@router.post("/rent-reminders/send")
def send_rent_reminders(
    days: Optional[int] = Query(None, ge=0, le=31),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return send_due_reminders(db, days=days)
