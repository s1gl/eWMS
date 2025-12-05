from fastapi import APIRouter

from app.api import routes

api_router = APIRouter()
api_router.include_router(routes.health_router)
api_router.include_router(routes.warehouses_router)
api_router.include_router(routes.zones_router)
api_router.include_router(routes.locations_router)
api_router.include_router(routes.items_router)
api_router.include_router(routes.inventory_router)

