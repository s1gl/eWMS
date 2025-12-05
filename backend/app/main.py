from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router


def get_application() -> FastAPI:
    """Configure FastAPI application."""
    application = FastAPI(title="WMS API", version="0.1.0")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router)
    return application


app = get_application()
