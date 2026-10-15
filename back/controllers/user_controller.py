from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Annotated, List

from sqlalchemy.orm import Session

from auth_deps import get_current_user, require_admin
from database import get_db
from schemas.user_schemas import CreateUser, Token, UpdateUser, UserResponse
from services import user_service

router = APIRouter(prefix="", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

db_dependency = Annotated[Session, Depends(get_db)]
admin_dependency = Annotated[dict, Depends(require_admin)]

@router.post("/signUp")
def register(user: CreateUser, db: db_dependency, _admin: admin_dependency):
    user_service.create_user(db, user)
    return {"message": "User created successfully"}

@router.post("/login", response_model=Token)
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: db_dependency):
    try:
        user = user_service.authenticate(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        role = user.role.value if hasattr(user.role, "value") else str(user.role)
        token = user_service.generate_token(user.email, user.id, role)
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        return {"access_token": token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[login] ERROR: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Error interno al iniciar sesión")

@router.get("/users", response_model=List[UserResponse])
def list_users(db: db_dependency, _admin: admin_dependency):
    return [user_service.to_response(u) for u in user_service.list_users(db)]

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: CreateUser, db: db_dependency, _admin: admin_dependency):
    return user_service.to_response(user_service.create_user(db, user))

@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, data: UpdateUser, db: db_dependency, admin: admin_dependency):
    updated = user_service.update_user(db, user_id, data, admin.get("user_id"))
    return user_service.to_response(updated)

@router.delete("/user/id/{user_id}")
def delete_user_by_id(user_id: int, db: db_dependency, _admin: admin_dependency):
    user_service.delete_by_id(db, user_id)
    return {"message": "User deleted successfully"}

@router.delete("/user/email/{email}")
def delete_user_by_email(email: str, db: db_dependency, _admin: admin_dependency):
    user_service.delete_by_email(db, email)
    return {"message": "User deleted successfully"}

@router.get("/user/name/{user_id}")
def get_user_name(user_id: int, db: db_dependency, _user: Annotated[dict, Depends(get_current_user)]):
    return {"name": user_service.get_user_name(db, user_id)}
