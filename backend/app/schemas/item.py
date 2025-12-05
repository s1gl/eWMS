from typing import Optional

from app.schemas.base import ORMModel
from pydantic import BaseModel


class ItemCreate(BaseModel):
    sku: str
    name: str
    barcode: Optional[str] = None
    unit: str = "pcs"


class ItemRead(ORMModel):
    id: int
    sku: str
    name: str
    barcode: Optional[str] = None
    unit: str
    is_active: bool

