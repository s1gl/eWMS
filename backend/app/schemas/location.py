from typing import Optional

from app.schemas.base import ORMModel
from pydantic import BaseModel


class LocationCreate(BaseModel):
    warehouse_id: int
    code: str
    zone_id: Optional[int] = None
    description: Optional[str] = None


class LocationRead(ORMModel):
    id: int
    warehouse_id: int
    zone_id: Optional[int] = None
    code: str
    description: Optional[str] = None
    is_active: bool

