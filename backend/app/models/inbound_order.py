import enum
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class InboundStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class InboundOrder(Base):
    __tablename__ = "inbound_orders"

    id = Column(Integer, primary_key=True, index=True)
    external_number = Column(String(100), nullable=False)
    warehouse_id = Column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    partner_id = Column(
        Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True
    )
    status = Column(Enum(InboundStatus), nullable=False, default=InboundStatus.draft)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines = relationship(
        "InboundOrderLine",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class InboundOrderLine(Base):
    __tablename__ = "inbound_order_lines"

    id = Column(Integer, primary_key=True, index=True)
    inbound_order_id = Column(
        Integer, ForeignKey("inbound_orders.id", ondelete="CASCADE"), nullable=False
    )
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    expected_qty = Column(Integer, nullable=False)
    received_qty = Column(Integer, nullable=False, default=0)
    location_id = Column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    line_status = Column(String(50), nullable=True)

    order = relationship("InboundOrder", back_populates="lines")
