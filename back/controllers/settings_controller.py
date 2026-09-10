import os
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import UPLOADS_ROOT, get_db
from models.app_setting import AppSetting

router = APIRouter(prefix="/settings", tags=["Settings"])

RECEIPT_SIGNATURE_KEY = "receipt_signature_path"
SIGNATURE_DIR = os.path.join(os.path.abspath(UPLOADS_ROOT), "signatures")
os.makedirs(SIGNATURE_DIR, exist_ok=True)

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _get_value(db: Session, key: str):
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else None


def _set_value(db: Session, key: str, value: str | None):
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    db.commit()


def _unlink_if_local(path: str | None):
    if not path or not path.startswith("/uploads/signatures/"):
        return
    name = os.path.basename(path)
    dest = os.path.join(SIGNATURE_DIR, name)
    if os.path.isfile(dest):
        try:
            os.remove(dest)
        except OSError:
            pass


@router.get("/receipt-signature")
def get_receipt_signature(db: Session = Depends(get_db)):
    path = _get_value(db, RECEIPT_SIGNATURE_KEY)
    if path:
        name = os.path.basename(path)
        dest = os.path.join(SIGNATURE_DIR, name)
        if not os.path.isfile(dest):
            return {"path": None}
    return {"path": path or None}


@router.post("/receipt-signature")
async def upload_receipt_signature(
    signature: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content_type = signature.content_type or ""
    ext = ALLOWED_TYPES.get(content_type)
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Archivo inválido. Usá PNG, JPG o WEBP (mejor PNG con fondo transparente).",
        )
    data = await signature.read()
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 2 MB")

    previous = _get_value(db, RECEIPT_SIGNATURE_KEY)
    stored_name = f"receiver_{uuid.uuid4().hex}{ext}"
    dest = os.path.join(SIGNATURE_DIR, stored_name)
    os.makedirs(SIGNATURE_DIR, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)
    path = f"/uploads/signatures/{stored_name}"
    _set_value(db, RECEIPT_SIGNATURE_KEY, path)
    _unlink_if_local(previous)
    return {"path": path}


@router.delete("/receipt-signature")
def delete_receipt_signature(db: Session = Depends(get_db)):
    previous = _get_value(db, RECEIPT_SIGNATURE_KEY)
    _unlink_if_local(previous)
    _set_value(db, RECEIPT_SIGNATURE_KEY, None)
    return {"path": None}
