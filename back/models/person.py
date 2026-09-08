from sqlalchemy import Column, Integer, String
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
    rental_contracts = relationship("RentalContract", back_populates="tenant")
    rental_contract = relationship(
        "RentalContract",
        uselist=False,
        viewonly=True,
        overlaps="rental_contracts,tenant",
        primaryjoin="and_(Tenant.id==foreign(RentalContract.tenant_id), RentalContract.status==1)",
    )

class Owner(Base):
    __tablename__ = "owners"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    phone = Column(String)
    email = Column(String)
    status = Column(Integer, default=1)
    properties = relationship("Property", back_populates="owner")
    garages = relationship("Garage", back_populates="owner")

