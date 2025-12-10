from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.inbound_order import InboundStatus, InboundCondition


class InboundOrderLineCreate(BaseModel):
    item_id: int
    expected_qty: int = Field(gt=0)
    received_qty: int = Field(default=0, ge=0)
    location_id: Optional[int] = None
    line_status: Optional[str] = None


class InboundOrderLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inbound_order_id: int
    item_id: int
    expected_qty: int
    received_qty: int
    location_id: Optional[int] = None
    line_status: Optional[str] = None


class InboundOrderCreate(BaseModel):
    external_number: str
    warehouse_id: int
    partner_id: Optional[int] = None
    lines: List[InboundOrderLineCreate]
    status: Optional[InboundStatus] = None


class InboundOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_number: str
    warehouse_id: int
    partner_id: Optional[int] = None
    status: InboundStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    lines: List[InboundOrderLineRead]


class InboundOrderStatusUpdate(BaseModel):
    status: InboundStatus


class InboundReceiveRequest(BaseModel):
    line_id: Optional[int] = None
    qty: int = Field(gt=0)
    tare_id: int
    item_id: Optional[int] = None
    condition: Optional[InboundCondition] = None


class InboundCloseTareRequest(BaseModel):
    tare_id: int
    location_id: int
