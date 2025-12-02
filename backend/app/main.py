from fastapi import FastAPI

from app.db import session  # noqa: F401  # чтобы engine создался
from app.models import *  # noqa: F401,F403

app = FastAPI(title="WMS API")


@app.get("/health")
def health_check():
    return {"status": "ok"}
