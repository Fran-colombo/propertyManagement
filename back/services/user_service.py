from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from jose import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from models.user_model import RoleEnum, User
from repositories import user_repository as user_repo
from schemas.user_schemas import CreateUser



SECRET_KEY = "sinalientoputotetradescendidoporput0ycagon"
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
