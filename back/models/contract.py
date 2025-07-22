from datetime import date
from sqlalchemy import Column, Integer, ForeignKey, Date, Float, Boolean, Enum, String, event
from sqlalchemy.orm import relationship
from models.base import Base 
from database import Base
# from datetime import date, timedelta
# from dateutil.relativedelta import relativedelta

from models.index import IndexTypeEnum
from schemas.enums.enums import AdjustmentFrequencyEnum, CurrencyEnum



class RentalContract(Base):
    __tablename__ = "rental_contracts"
    
    id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    garage_id = Column(Integer, ForeignKey("garages.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    real_agency_id = Column(Integer, ForeignKey("real_agencies.id"), nullable=True)
    real_agency = relationship("RealAgency", back_populates="contracts")
    start_date = Column(Date)
    end_date = Column(Date)
    currency = Column(Enum(CurrencyEnum))
    base_rent = Column(Float)
    index_type = Column(Enum(IndexTypeEnum), nullable=True)
    frequency_adjustment = Column(Enum(AdjustmentFrequencyEnum), nullable=True)
    includes_garage = Column(Boolean, default=False)
    fire_insurance = Column(Boolean, default=False)
    pays_api = Column(Boolean, default=False)
    pays_tgi = Column(Boolean, default=False)
    pays_epe = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    status=   Column(Integer, default=1)

    property = relationship("Property", back_populates="rental_contract")
    tenant = relationship("Tenant", back_populates="rental_contract")
    garage = relationship("Garage", back_populates="rental_contract")
    periods = relationship("ContractPeriod", back_populates="contract", cascade="all, delete-orphan")

    # @property
    # def is_active(self):
    #     today = date.today()
    #     return self.start_date <= today <= self.end_date