from sqlalchemy import Boolean, Column, Integer, String, Enum

from app.db.base import Base
import enum


class PartnerType(str, enum.Enum):
    customer = "customer"
    supplier = "supplier"


class Partner(Base):
    __tablename__ = "partners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    type = Column(Enum(PartnerType), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
