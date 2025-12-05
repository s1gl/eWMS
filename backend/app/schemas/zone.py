from app.schemas.base import ORMModel
from pydantic import BaseModel


class ZoneCreate(BaseModel):
    name: str
    code: str
    warehouse_id: int


class ZoneRead(ORMModel):
    id: int
    name: str
    code: str
    warehouse_id: int

