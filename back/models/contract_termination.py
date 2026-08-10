from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class CancellationPartyEnum(str, enum.Enum):
    INQUILINO = "INQUILINO"
    PROPIETARIO = "PROPIETARIO"


class SettlementDirectionEnum(str, enum.Enum):
    PROPIETARIO_A_INQUILINO = "PROPIETARIO_A_INQUILINO"
    INQUILINO_A_PROPIETARIO = "INQUILINO_A_PROPIETARIO"
    SIN_MONTO = "SIN_MONTO"


class ContractTermination(Base):
    __tablename__ = "contract_terminations"

    id = Column(Integer, primary_key=True)
    rental_contract_id = Column(Integer, ForeignKey("rental_contracts.id"), nullable=False)
    cancelled_by = Column(SQLEnum(CancellationPartyEnum), nullable=False)
    reason = Column(Text, nullable=False)
    settlement_amount = Column(Float, default=0.0)
    settlement_direction = Column(
        SQLEnum(SettlementDirectionEnum),
        default=SettlementDirectionEnum.SIN_MONTO,
    )
    effective_date = Column(Date, nullable=False)
    # If true: unpaid periods from next calendar month until effective_date are waived
    waive_remaining_rent = Column(Boolean, default=False)
    receipt_path = Column(String, nullable=True)
    receipt_original_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("RentalContract", back_populates="termination")
