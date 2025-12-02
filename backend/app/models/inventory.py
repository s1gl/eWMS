from sqlalchemy import Column, ForeignKey, Integer, DateTime
from sqlalchemy.sql import func

from app.db.base import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    warehouse_id = Column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    location_id = Column(
        Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    quantity = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
