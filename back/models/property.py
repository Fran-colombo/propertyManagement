from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.base import Base

class RealAgency(Base):
    __tablename__ = "real_agencies"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    direction = Column(String)
    status = Column(Integer, default=1)
    contracts = relationship("RentalContract", back_populates="real_agency")

class Property(Base):
    __tablename__ = "properties"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("owners.id"), nullable=False)
    direction = Column(String)
    floor = Column(String)
    apartment = Column(String)
    status = Column(Integer, default=1)
    owner = relationship("Owner", back_populates="properties")
    rental_contract = relationship("RentalContract", uselist=False, back_populates="property")
    garages = relationship("Garage", back_populates="property")


class Garage(Base):
    __tablename__ = "garages"
    id = Column(Integer, primary_key=True)
    number = Column(String)
    owner_id = Column(Integer, ForeignKey("owners.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    status = Column(Integer, default=1)
    owner = relationship("Owner", back_populates="garages")
    property = relationship("Property", back_populates="garages")
    rental_contract = relationship(
        "RentalContract", 
        back_populates="garage",
        uselist=False  
    )
