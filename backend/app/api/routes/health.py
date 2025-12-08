from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.get("/")
async def root():
    return {"status": "ok", "service": "eWMS API"}

