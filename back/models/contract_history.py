from sqlalchemy import Column, ForeignKey, Integer, String, Float, Date
from sqlalchemy.orm import relationship
from database import Base

class ContractHistory(Base):
    __tablename__ = "all_contracts"

    id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("properties.id"))
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    property_address = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    cancelled = Column(Integer, default=0)  

    property = relationship("Property")
    tenant = relationship("Tenant")
