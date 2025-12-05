from pydantic import BaseModel


class ORMModel(BaseModel):
    """Base schema with ORM support."""

    class Config:
        from_attributes = True
        orm_mode = True

