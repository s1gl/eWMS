from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.picking import PickingStatus


class PickingTaskLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    picking_task_id: int
    item_id: int
    from_location_id: Optional[int] = None
    qty_to_pick: int
    qty_picked: int


class PickingTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    warehouse_id: int
    outbound_order_id: int
    status: PickingStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    lines: List[PickingTaskLineRead]


class PickingTaskCompleteLine(BaseModel):
    line_id: int
    qty_picked: int = Field(gt=0)
