from app.schemas.base import ORMModel
from pydantic import BaseModel


class WarehouseCreate(BaseModel):
    name: str
    code: str


class WarehouseRead(ORMModel):
    id: int
    name: str
    code: str
    is_active: bool

