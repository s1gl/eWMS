from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    zones = relationship("Zone", back_populates="warehouse")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)

    warehouse = relationship("Warehouse", back_populates="zones")
    locations = relationship("Location", back_populates="zone")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(
        Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    zone_id = Column(
        Integer, ForeignKey("zones.id", ondelete="SET NULL"), nullable=True
    )
    code = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    zone = relationship("Zone", back_populates="locations")
