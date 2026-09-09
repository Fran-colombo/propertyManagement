from sqlalchemy import Column, Date, ForeignKey, Integer, String, UniqueConstraint
from models.base import Base


class ReminderLog(Base):
    __tablename__ = "reminder_logs"
    __table_args__ = (
        UniqueConstraint("period_id", "kind", "sent_on", name="uq_reminder_period_kind_day"),
    )

    id = Column(Integer, primary_key=True)
    period_id = Column(Integer, ForeignKey("contract_periods.id"), nullable=False, index=True)
    kind = Column(String(50), nullable=False)
    sent_on = Column(Date, nullable=False, index=True)
    recipient = Column(String(255), nullable=True)
