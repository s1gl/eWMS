from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TareTypeCreate(BaseModel):
    code: str
    name: str
    prefix: str
    level: int = 1


class TareTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    prefix: str
    level: int


class TareCreate(BaseModel):
    warehouse_id: int
    type_id: int
    location_id: Optional[int] = None
    parent_tare_id: Optional[int] = None


class TareRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    warehouse_id: int
    type_id: int
    location_id: Optional[int] = None
    parent_tare_id: Optional[int] = None
    tare_code: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TareItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tare_id: int
    item_id: int
    quantity: int
