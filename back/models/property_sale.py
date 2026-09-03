from sqlalchemy import Column, Integer, String, Float, Date, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class PropertySale(Base):
    __tablename__ = "property_sales"

    id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    seller_owner_id = Column(Integer, ForeignKey("owners.id"), nullable=True)
    buyer_owner_id = Column(Integer, ForeignKey("owners.id"), nullable=True)
    buyer_name = Column(String)
    sale_date = Column(Date, nullable=False)
    currency = Column(String, default="PESOS")
    total_amount = Column(Float, nullable=False)
    keep_managing = Column(Boolean, default=True)
    status = Column(String, default="PENDIENTE")
    notes = Column(String, nullable=True)

    property = relationship("Property", back_populates="sales")
    seller = relationship("Owner", foreign_keys=[seller_owner_id])
    buyer = relationship("Owner", foreign_keys=[buyer_owner_id])
    installments = relationship(
        "PropertySalePayment",
        back_populates="sale",
        cascade="all, delete-orphan",
        order_by="PropertySalePayment.due_date",
    )


class PropertySalePayment(Base):
    __tablename__ = "property_sale_payments"

    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("property_sales.id"), nullable=False)
    due_date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    paid_at = Column(Date, nullable=True)
    method = Column(String, nullable=True)
    received_by = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    kind = Column(String, default="cuota")

    sale = relationship("PropertySale", back_populates="installments")
