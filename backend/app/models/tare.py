import enum
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class TareStatus(str, enum.Enum):
    inbound = "inbound"
    storage = "storage"
    picking = "picking"
    outbound = "outbound"
    closed = "closed"


class TareType(Base):
    __tablename__ = "tare_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    prefix = Column(String(50), nullable=False)
    level = Column(Integer, nullable=False, default=1)

    tares = relationship("Tare", back_populates="type")


class Tare(Base):
    __tablename__ = "tares"
    __table_args__ = (UniqueConstraint("tare_code", name="uq_tare_code"),)

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    type_id = Column(Integer, ForeignKey("tare_types.id", ondelete="RESTRICT"), nullable=False)
    tare_code = Column(String(100), nullable=False, unique=True, index=True)
    parent_tare_id = Column(Integer, ForeignKey("tares.id", ondelete="SET NULL"), nullable=True)
    status = Column(
        Enum(TareStatus, name="tarestates"),
        nullable=False,
        default=TareStatus.inbound,
        server_default=TareStatus.inbound.value,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    type = relationship("TareType", back_populates="tares")
    parent = relationship("Tare", remote_side=[id])
    items = relationship("TareItem", back_populates="tare", cascade="all, delete-orphan")


class TareItem(Base):
    __tablename__ = "tare_items"

    id = Column(Integer, primary_key=True, index=True)
    tare_id = Column(Integer, ForeignKey("tares.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)

    tare = relationship("Tare", back_populates="items")

