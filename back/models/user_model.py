import enum
from sqlalchemy import Column, Integer, String, Enum
from database import Base


class RoleEnum(enum.Enum):
     admin = "admin"
     user = "user"

class User(Base):
        __tablename__ = "users"

        id = Column(Integer, primary_key=True, index=True)
        name = Column(String, index=True)
        surname = Column(String, index=True)
        email = Column(String, unique=True, index=True)
        password = Column(String, index=True)
        role = Column(Enum(RoleEnum), index=True)
        status = Column(Integer, default=1)