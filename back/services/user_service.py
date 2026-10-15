from datetime import datetime, timedelta
import os
from sqlalchemy.orm import Session
from jose import jwt
from passlib.context import CryptContext
from fastapi import HTTPException
from models.user_model import RoleEnum, User
from repositories import user_repository as user_repo
from schemas.user_schemas import CreateUser, UpdateUser, UserResponse



SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-secret-change-me")
ALGORITHM = "HS256"
bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_user(db: Session, user_data: CreateUser):
    email = user_data.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido")
    name = user_data.name.strip()
    surname = user_data.surname.strip()
    if not name or not surname:
        raise HTTPException(status_code=400, detail="Completá nombre y apellido")
    role = RoleEnum(user_data.role)
    hashed_pw = bcrypt_context.hash(user_data.password)

    existing = user_repo.get_by_email(db, email)
    if existing:
        if existing.status == 1:
            raise HTTPException(status_code=400, detail="Ya hay un usuario con ese email")
        existing.name = name.capitalize()
        existing.surname = surname.capitalize()
        existing.password = hashed_pw
        existing.role = role
        existing.status = 1
        db.commit()
        db.refresh(existing)
        return existing

    new_user = User(
        name=name.capitalize(),
        surname=surname.capitalize(),
        email=email,
        password=hashed_pw,
        role=role,
        status=1
    )
    return user_repo.create(db, new_user)


def list_users(db: Session):
    return user_repo.get_all(db)


def _active_admin_count(db: Session) -> int:
    return sum(
        1 for u in user_repo.get_all(db)
        if u.status == 1 and _role_value(u) == RoleEnum.admin.value
    )


def update_user(db: Session, user_id: int, data: UpdateUser, current_user_id: int):
    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    changes = data.model_dump(exclude_unset=True)
    removes_admin = _role_value(user) == RoleEnum.admin.value and user.status == 1 and (
        changes.get("role") == RoleEnum.user.value or changes.get("status") == 0
    )
    if removes_admin and user.id == current_user_id:
        raise HTTPException(status_code=400, detail="No podés quitarte el acceso de administrador a vos mismo")
    if removes_admin and _active_admin_count(db) <= 1:
        raise HTTPException(status_code=400, detail="Tiene que quedar al menos un administrador activo")
    if changes.get("password"):
        user.password = bcrypt_context.hash(changes["password"])
    if changes.get("role"):
        user.role = RoleEnum(changes["role"])
    if changes.get("status") is not None:
        user.status = changes["status"]
    db.commit()
    db.refresh(user)
    return user


def to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name or "",
        surname=user.surname or "",
        email=user.email or "",
        role=_role_value(user),
        status=user.status if user.status is not None else 1,
    )

def _role_value(user: User) -> str:
    role = getattr(user, "role", None)
    if role is None:
        return RoleEnum.user.value
    return role.value if hasattr(role, "value") else str(role)


def authenticate(db: Session, email: str, password: str):
    try:
        user = user_repo.get_by_email(db, email) or user_repo.get_by_email(
            db, (email or "").strip().lower()
        )
    except Exception as e:
        print(f"[auth] ERROR loading user {email}: {e}", flush=True)
        db.rollback()
        return None
    if not user or user.status != 1:
        return None

    admin_email = os.getenv("ADMIN_USER_EMAIL", "").strip()
    admin_password = os.getenv("ADMIN_USER_PASSWORD", "").strip()

    try:
        valid = bcrypt_context.verify(password, user.password)
    except Exception as e:
        print(f"[auth] ERROR verifying password for {email}: {e}", flush=True)
        valid = False
        if admin_email and email == admin_email and password == admin_password:
            user.password = bcrypt_context.hash(password)
            user.role = RoleEnum.admin
            user.status = 1
            db.commit()
            print(f"[auth] Rehashed admin password for {email}", flush=True)
            return user

    if not valid:
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
