"""Wipe business data and keep only the admin from ADMIN_USER_* env vars.

Run inside the production backend container. Does not touch the DEMO stack.

  docker compose -f docker-compose.yml exec backend python wipe_except_admin.py
"""
import os
import shutil

from database import DB_PATH, DATA_DIR, SessionLocal, engine, init_db
from services import user_service


def main() -> None:
    engine.dispose()
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    for suffix in ("-wal", "-shm", "-journal"):
        extra = DB_PATH + suffix
        if os.path.exists(extra):
            os.remove(extra)

    uploads = os.path.join(DATA_DIR, "uploads")
    if os.path.isdir(uploads):
        shutil.rmtree(uploads, ignore_errors=True)
    os.makedirs(os.path.join(uploads, "terminations"), exist_ok=True)
    os.makedirs(os.path.join(uploads, "contracts"), exist_ok=True)

    init_db()
    db = SessionLocal()
    try:
        user_service.ensure_admin_from_env(db)
        db.commit()
        email = os.getenv("ADMIN_USER_EMAIL", "").strip() or "(ADMIN_USER_EMAIL vacío)"
        print(f"[wipe] Database reset. Only admin remains: {email}")
        print(f"[wipe] DB_PATH={DB_PATH}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
