from typing import Literal

from app.schemas.base import ORMModel
from pydantic import BaseModel

ZoneTypeLiteral = Literal["inbound", "storage", "outbound"]


class ZoneCreate(BaseModel):
    name: str
    code: str
    warehouse_id: int
    zone_type: ZoneTypeLiteral


class ZoneUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    warehouse_id: int | None = None
    zone_type: ZoneTypeLiteral | None = None


class ZoneRead(ORMModel):
    id: int
    name: str
    code: str
    warehouse_id: int
    zone_type: ZoneTypeLiteral
