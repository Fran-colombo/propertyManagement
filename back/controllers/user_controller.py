from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Annotated

from sqlalchemy.orm import Session

from database import get_db
from schemas.user_schemas import CreateUser, Token
from services import user_service

router = APIRouter(prefix="", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

db_dependency = Annotated[Session, Depends(get_db)]

@router.post("/signUp")
def register(user: CreateUser, db: db_dependency):
    user_service.create_user(db, user)
    return {"message": "User created successfully"}

@router.post("/login", response_model=Token)
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: db_dependency):
    user = user_service.authenticate(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = user_service.generate_token(user.email, user.id, user.role.value)
    return {"access_token": token, "token_type": "bearer"}

@router.delete("/user/id/{user_id}")
def delete_user_by_id(user_id: int, db: db_dependency):
    user_service.delete_by_id(db, user_id)
    return {"message": "User deleted successfully"}

@router.delete("/user/email/{email}")
def delete_user_by_email(email: str, db: db_dependency):
    user_service.delete_by_email(db, email)
    return {"message": "User deleted successfully"}

@router.get("/user/name/{user_id}")
def get_user_name(user_id: int, db: db_dependency):
    return {"name": user_service.get_user_name(db, user_id)}
