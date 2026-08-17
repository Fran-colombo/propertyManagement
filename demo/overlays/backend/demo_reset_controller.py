"""DEMO-only routes. Copied into the DEMO image; not present in production."""
import os
import shutil
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import DB_PATH, SessionLocal, engine, get_db, init_db

router = APIRouter(prefix="/demo", tags=["DEMO"])

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"


def _require_demo_mode() -> None:
    if os.getenv("DEMO_MODE", "").strip().lower() not in ("1", "true", "yes", "on"):
        raise HTTPException(status_code=404, detail="Not found")


def _require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1].strip()
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/reset")
def reset_demo(
    _: Annotated[None, Depends(_require_token)],
    db: Session = Depends(get_db),
):
    _require_demo_mode()
    db.close()
    _wipe_and_reseed()
    return {"message": "DEMO data restored to the original fictional dataset"}


def _wipe_and_reseed() -> None:
    engine.dispose()

    db_path = DB_PATH
    data_dir = os.path.dirname(db_path)
    uploads = os.path.join(data_dir, "uploads")

    if os.path.exists(db_path):
        os.remove(db_path)
    for suffix in ("-wal", "-shm", "-journal"):
        extra = db_path + suffix
        if os.path.exists(extra):
            os.remove(extra)

    if os.path.isdir(uploads):
        shutil.rmtree(uploads, ignore_errors=True)
    os.makedirs(uploads, exist_ok=True)
    os.makedirs(os.path.join(uploads, "terminations"), exist_ok=True)

    init_db()
    session = SessionLocal()
    try:
        from services import user_service
        from seed_demo import seed_demo

        user_service.ensure_admin_from_env(session)
        seed_demo(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
