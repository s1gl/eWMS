from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.outbound_order import OutboundStatus


class OutboundOrderLineCreate(BaseModel):
    item_id: int
    ordered_qty: int = Field(gt=0)


class OutboundOrderLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    outbound_order_id: int
    item_id: int
    ordered_qty: int
    picked_qty: int
    shipped_qty: int


class OutboundOrderCreate(BaseModel):
    external_number: str
    warehouse_id: int
    partner_id: Optional[int] = None
    status: OutboundStatus = OutboundStatus.draft
    lines: List[OutboundOrderLineCreate]


class OutboundOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_number: str
    warehouse_id: int
    partner_id: Optional[int] = None
    status: OutboundStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    lines: List[OutboundOrderLineRead]


class OutboundOrderStatusUpdate(BaseModel):
    status: OutboundStatus
