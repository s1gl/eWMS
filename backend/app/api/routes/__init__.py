from app.api.routes.health import router as health_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.items import router as items_router
from app.api.routes.locations import router as locations_router
from app.api.routes.warehouses import router as warehouses_router
from app.api.routes.zones import router as zones_router
from app.api.routes.partners import router as partners_router
from app.api.routes.inbound_orders import router as inbound_orders_router
from app.api.routes.outbound_orders import router as outbound_orders_router
from app.api.routes.picking import router as picking_router
from app.api.routes.reports import router as reports_router
from app.api.routes.tares import router as tares_router

__all__ = [
    "health_router",
    "inventory_router",
    "items_router",
    "locations_router",
    "warehouses_router",
    "zones_router",
    "partners_router",
    "inbound_orders_router",
    "outbound_orders_router",
    "picking_router",
    "reports_router",
    "tares_router",
]

