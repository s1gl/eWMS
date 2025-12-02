# backend/app/core/config.py
from pydantic import BaseModel
import os


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://wms:wms_password@db:5432/wms",
    )


settings = Settings()
