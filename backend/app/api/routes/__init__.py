from app.api.routes.health import router as health_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.items import router as items_router
from app.api.routes.locations import router as locations_router
from app.api.routes.warehouses import router as warehouses_router
from app.api.routes.zones import router as zones_router

__all__ = [
    "health_router",
    "inventory_router",
    "items_router",
    "locations_router",
    "warehouses_router",
    "zones_router",
]

