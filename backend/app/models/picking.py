import enum
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class PickingStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    done = "done"


class PickingTask(Base):
    __tablename__ = "picking_tasks"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    outbound_order_id = Column(
        Integer, ForeignKey("outbound_orders.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(Enum(PickingStatus), nullable=False, default=PickingStatus.new)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines = relationship(
        "PickingTaskLine",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PickingTaskLine(Base):
    __tablename__ = "picking_task_lines"

    id = Column(Integer, primary_key=True, index=True)
    picking_task_id = Column(
        Integer, ForeignKey("picking_tasks.id", ondelete="CASCADE"), nullable=False
    )
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    from_location_id = Column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    qty_to_pick = Column(Integer, nullable=False)
    qty_picked = Column(Integer, nullable=False, default=0)

    task = relationship("PickingTask", back_populates="lines")
