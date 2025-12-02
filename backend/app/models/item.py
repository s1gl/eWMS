from sqlalchemy import Boolean, Column, Integer, String

from app.db.base import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    barcode = Column(String(100), nullable=True)
    unit = Column(String(20), nullable=False, default="pcs")
    is_active = Column(Boolean, nullable=False, default=True)
