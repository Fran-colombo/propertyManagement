from datetime import datetime, timedelta
import os
from sqlalchemy.orm import Session
from jose import jwt
from passlib.context import CryptContext
from fastapi import HTTPException
from models.user_model import RoleEnum, User
from repositories import user_repository as user_repo
from schemas.user_schemas import CreateUser



SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-secret-change-me")
ALGORITHM = "HS256"
bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_user(db: Session, user_data: CreateUser):
    existing = user_repo.get_by_email(db, user_data.email)
    if existing:
        if existing.status == 1:
            raise HTTPException(status_code=400, detail="Email ya registrado")
        else:
            raise HTTPException(status_code=400, detail="Usuario desactivado")

    hashed_pw = bcrypt_context.hash(user_data.password)

    new_user = User(
        name=user_data.name.capitalize(),
        surname=user_data.surname.capitalize(),
        email=user_data.email,
        password=hashed_pw,
        role=RoleEnum.user,
        status=1
    )
    return user_repo.create(db, new_user)

def authenticate(db: Session, email: str, password: str):
    user = user_repo.get_by_email(db, email)
    if not user or not bcrypt_context.verify(password, user.password):
        return None
    return user

def generate_token(email: str, user_id: int, role: str, expires_delta: timedelta = timedelta(minutes=30)):
    payload = {
        "sub": email,
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + expires_delta
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def delete_by_id(db: Session, user_id: int):
    if not user_repo.soft_delete_by_id(db, user_id):
        raise HTTPException(status_code=404, detail="User not found or already inactive")

def delete_by_email(db: Session, email: str):
    if not user_repo.soft_delete_by_email(db, email):
        raise HTTPException(status_code=404, detail="User not found or already inactive")

def get_user_name(db: Session, user_id: int):
    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return f"{user.name} {user.surname}"


def ensure_admin_from_env(db: Session) -> None:
    """Create admin user from ADMIN_USER_* env vars if missing."""
    email = os.getenv("ADMIN_USER_EMAIL", "").strip()
    password = os.getenv("ADMIN_USER_PASSWORD", "").strip()
    if not email or not password:
        return

    existing = user_repo.get_by_email(db, email)
    if existing:
        if existing.status != 1:
            existing.status = 1
            existing.password = bcrypt_context.hash(password)
            existing.role = RoleEnum.admin
            db.commit()
            print(f"[seed] Reactivated admin user: {email}")
        return

    name = os.getenv("ADMIN_USER_NAME", "Admin").strip() or "Admin"
    surname = os.getenv("ADMIN_USER_SURNAME", "Conkreto").strip() or "Conkreto"
    admin = User(
        name=name.capitalize(),
        surname=surname.capitalize(),
        email=email,
        password=bcrypt_context.hash(password),
        role=RoleEnum.admin,
        status=1,
    )
    user_repo.create(db, admin)
    print(f"[seed] Created admin user: {email}")
