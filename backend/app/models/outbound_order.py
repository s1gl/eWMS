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


class OutboundStatus(str, enum.Enum):
    draft = "draft"
    picking = "picking"
    packed = "packed"
    shipped = "shipped"
    cancelled = "cancelled"


class OutboundOrder(Base):
    __tablename__ = "outbound_orders"

    id = Column(Integer, primary_key=True, index=True)
    external_number = Column(String(100), nullable=False)
    warehouse_id = Column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    partner_id = Column(
        Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True
    )
    status = Column(
        Enum(OutboundStatus), nullable=False, default=OutboundStatus.draft
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines = relationship(
        "OutboundOrderLine",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class OutboundOrderLine(Base):
    __tablename__ = "outbound_order_lines"

    id = Column(Integer, primary_key=True, index=True)
    outbound_order_id = Column(
        Integer, ForeignKey("outbound_orders.id", ondelete="CASCADE"), nullable=False
    )
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    ordered_qty = Column(Integer, nullable=False)
    picked_qty = Column(Integer, nullable=False, default=0)
    shipped_qty = Column(Integer, nullable=False, default=0)

    order = relationship("OutboundOrder", back_populates="lines")
