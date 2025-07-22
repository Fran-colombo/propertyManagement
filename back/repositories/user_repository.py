from sqlalchemy.orm import Session
from models.user_model import User


def get_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def create(db: Session, user: User):
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def soft_delete_by_id(db: Session, user_id: int):
    user = get_by_id(db, user_id)
    if user and user.status == 1:
        user.status = 0
        db.commit()
        return True
    return False

def soft_delete_by_email(db: Session, email: str):
    user = get_by_email(db, email)
    if user and user.status == 1:
        user.status = 0
        db.commit()
        return True
    return False
