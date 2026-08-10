from datetime import date
from typing import Optional
from pydantic import BaseModel, Field
from models.contract_termination import CancellationPartyEnum, SettlementDirectionEnum


class CancelContractDTO(BaseModel):
    cancelled_by: CancellationPartyEnum
    reason: str = Field(..., min_length=3)
    effective_date: date
    settlement_amount: float = Field(0, ge=0)
    settlement_direction: SettlementDirectionEnum = SettlementDirectionEnum.SIN_MONTO


class ContractTerminationResponse(BaseModel):
    id: int
    rental_contract_id: int
    cancelled_by: str
    reason: str
    settlement_amount: float
    settlement_direction: str
    effective_date: date
    receipt_path: Optional[str] = None
    receipt_original_name: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
