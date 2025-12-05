from typing import Optional

from app.schemas.base import ORMModel
from pydantic import BaseModel, Field


class InboundCreate(BaseModel):
    warehouse_id: int
    location_id: int
    item_id: int
    qty: int = Field(gt=0, description="Quantity must be greater than zero")


class MoveCreate(BaseModel):
    warehouse_id: int
    from_location_id: int
    to_location_id: int
    item_id: int
    qty: int = Field(gt=0, description="Quantity must be greater than zero")


class InventoryRead(ORMModel):
    id: int
    warehouse_id: int
    location_id: int
    item_id: int
    quantity: int

