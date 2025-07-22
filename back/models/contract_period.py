from models.base import Base 
from sqlalchemy import Column, Integer, ForeignKey, Date, Float, Enum, String
from sqlalchemy.orm import relationship
from database import Base
from models.base import Base
from schemas.enums.enums import IndexTypeEnum, PaymentStatusEnum




class ContractPeriod(Base):
    __tablename__ = "contract_periods"
    
    id = Column(Integer, primary_key=True)
    contract_id = Column(Integer, ForeignKey("rental_contracts.id"))
    
    start_date = Column(Date)
    end_date = Column(Date)
    due_date = Column(Date)
    
    index_id = Column(Integer, ForeignKey("indices.id"), nullable=True)  
    index_type = Column(Enum(IndexTypeEnum), nullable=True) 
    applied_index_value = Column(Float, nullable=True, default=None) 

    base_rent = Column(Float, default=0.0)  
    indexed_amount = Column(Float, default=0.0)  
    total_amount = Column(Float, default=0.0)  
    
    epe_amount = Column(Float, default=0.0)
    tgi_amount = Column(Float, default=0.0)
    api_amount = Column(Float, default=0.0)
    fire_proof_amount = Column(Float, default=0.0)
    
    payment_date = Column(Date, nullable=True)
    payment_status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDIENTE)
    amount_paid = Column(Float, default=0.0)
    payment_method = Column(String(50), nullable=True)  
    payment_reference = Column(String(100), nullable=True)  
    
    transactions = relationship("Transaction", back_populates="period", cascade="all, delete-orphan")
    contract = relationship("RentalContract", back_populates="periods")
    index = relationship("Index")