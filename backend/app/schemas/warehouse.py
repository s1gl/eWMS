from app.schemas.base import ORMModel
from pydantic import BaseModel


class WarehouseCreate(BaseModel):
    name: str
    code: str


class WarehouseUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    is_active: bool | None = None


class WarehouseRead(ORMModel):
    id: int
    name: str
    code: str
    is_active: bool

