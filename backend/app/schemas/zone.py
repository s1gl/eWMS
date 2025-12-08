from app.schemas.base import ORMModel
from pydantic import BaseModel


class ZoneCreate(BaseModel):
    name: str
    code: str
    warehouse_id: int


class ZoneUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    warehouse_id: int | None = None


class ZoneRead(ORMModel):
    id: int
    name: str
    code: str
    warehouse_id: int

