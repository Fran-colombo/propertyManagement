from enum import Enum
from sqlalchemy import Column, Integer, Date, Float, Enum as SQLEnum
from models.base import Base 
# from database import Base
from models.base import Base
from sqlalchemy.orm import relationship

from schemas.enums.enums import IndexTypeEnum




class Index(Base):
    __tablename__ = "indices"
    id = Column(Integer, primary_key=True)
    type = Column(SQLEnum(IndexTypeEnum))  
    date_from = Column(Date)  
    date_to = Column(Date)    
    value = Column(Float)     
    periods = relationship("ContractPeriod", back_populates="index")

