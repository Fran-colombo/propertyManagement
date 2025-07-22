from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

class CreateTransactionDTO(BaseModel):
    amount: float = Field(gt=0)
    date: datetime
    method: str
    notes: Optional[str] = None
    period_id: int

class SimpleUser(BaseModel):
    id: int
    name: str

class ContractInfo(BaseModel):
    id: int
    owner: SimpleUser
    tenant: SimpleUser
    property_direction: str 

class PeriodInfo(BaseModel):
    id: int
    start_date: date
    end_date: date
    due_date: date
    payment_status: str
    total_amount: float
    amount_paid: float

class TransactionResponseDTO(BaseModel):
    id: int
    amount: float
    date: date
    method: str
    notes: Optional[str] = None
    contract: ContractInfo
    period: PeriodInfo

    class Config:
        orm_mode = True


class SimpleUser(BaseModel):
    id: int
    name: str

class ContractInfo(BaseModel):
    id: int
    owner: SimpleUser
    tenant: SimpleUser
    property_direction: str

class PeriodInfo(BaseModel):
    id: int
    start_date: date
    end_date: date
    due_date: date
    payment_status: str
    total_amount: float
    amount_paid: float
    remaining_amount: float

class TransactionResponseDTO(BaseModel):
    id: int
    amount: float
    date: date
    method: str
    notes: Optional[str] = None
    remaining_amount: Optional[float] = None
    contract: ContractInfo
    period: PeriodInfo

    class Config:
        orm_mode = True

class TransactionHistoryResponse(TransactionResponseDTO):
    class Config:
        extra = "ignore"  