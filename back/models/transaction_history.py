# from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
# from database import Base

# class TransactionHistory(Base):
#     __tablename__ = "transaction_history"
    
#     id = Column(Integer, primary_key=True)
#     transaction_id = Column(Integer, ForeignKey("transactions.id"))
#     amount = Column(Float)
#     date = Column(Date)
#     method = Column(String)
#     notes = Column(String, nullable=True)
    
#     contract_id = Column(Integer)
#     owner_id = Column(Integer)
#     owner_name = Column(String)
#     tenant_id = Column(Integer)
#     tenant_name = Column(String)
#     property_direction = Column(String)
    
#     period_id = Column(Integer)
#     period_start_date = Column(Date)
#     period_end_date = Column(Date)
#     period_due_date = Column(Date)
#     period_total_amount = Column(Float)

from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from database import Base

class TransactionHistory(Base):
    __tablename__ = "transaction_history"
    
    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    amount = Column(Float)
    date = Column(Date)
    method = Column(String)
    notes = Column(String, nullable=True)
    
    contract_id = Column(Integer)
    owner_id = Column(Integer)
    owner_name = Column(String)
    tenant_id = Column(Integer)
    tenant_name = Column(String)
    property_direction = Column(String)
    
    period_id = Column(Integer)
    period_start_date = Column(Date)
    period_end_date = Column(Date)
    period_due_date = Column(Date)
    period_total_amount = Column(Float)
    
    period_amount_paid = Column(Float)  
    period_payment_status = Column(String)  