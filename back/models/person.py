from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.base import Base

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    phone = Column(String)
    email = Column(String)
    status = Column(Integer, default=1)
    rental_contract = relationship("RentalContract", uselist=False, back_populates="tenant")

class Owner(Base):
    __tablename__ = "owners"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    phone = Column(String)
    email = Column(String)
    status = Column(Integer, default=1)
    properties = relationship("Property", back_populates="owner")
    garages = relationship("Garage", back_populates="owner")

