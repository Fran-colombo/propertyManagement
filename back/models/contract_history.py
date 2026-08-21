from sqlalchemy import Column, ForeignKey, Integer, String, Float, Date
from sqlalchemy.orm import relationship
from database import Base

class ContractHistory(Base):
    __tablename__ = "all_contracts"

    id = Column(Integer, primary_key=True)
    rental_contract_id = Column(Integer, ForeignKey("rental_contracts.id"), nullable=True)
    property_id = Column(Integer, ForeignKey("properties.id"))
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    property_address = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    cancelled = Column(Integer, default=0)
    cancellation_reason = Column(String, nullable=True)
    cancelled_by = Column(String, nullable=True)
    settlement_amount = Column(Float, nullable=True)
    settlement_direction = Column(String, nullable=True)
    receipt_path = Column(String, nullable=True)
    document_path = Column(String, nullable=True)

    property = relationship("Property")
    tenant = relationship("Tenant")
