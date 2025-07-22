from sqlalchemy import Column, Index, Integer, Float, Date, ForeignKey, String
from sqlalchemy.orm import relationship
from database import Base
from models.base import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    period_id = Column(Integer, ForeignKey("contract_periods.id"))
    
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    method = Column(String(50), nullable=False)  
    notes = Column(String(255), nullable=True)
    
    remaining_amount = Column(Float) 

    period = relationship("ContractPeriod", back_populates="transactions")
    
    __table_args__ = (
        Index('ix_transaction_period_id', 'period_id'),
        Index('ix_transaction_date', 'date'),
    )
