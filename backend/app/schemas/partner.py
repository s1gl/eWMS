from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.models.partner import PartnerType


class PartnerCreate(BaseModel):
    name: str
    code: str
    type: PartnerType
    is_active: bool = True


class PartnerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    type: PartnerType
    is_active: bool
