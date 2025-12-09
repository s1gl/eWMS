# backend/app/models/__init__.py
from app.db.base import Base  # чтобы Alembic видел Base

from .user import User
from .warehouse import Warehouse, Zone, Location, ZoneType
from .item import Item
from .inventory import Inventory
from .movement import Movement
from .partner import Partner, PartnerType
from .inbound_order import InboundOrder, InboundOrderLine, InboundStatus
from .outbound_order import OutboundOrder, OutboundOrderLine, OutboundStatus
from .picking import PickingTask, PickingTaskLine, PickingStatus
from .tare import Tare, TareItem, TareType, TareStatus

__all__ = [
    "Base",
    "User",
    "Warehouse",
    "Zone",
    "ZoneType",
    "Location",
    "Item",
    "Inventory",
    "Movement",
    "Partner",
    "PartnerType",
    "Tare",
    "TareItem",
    "TareType",
    "TareStatus",
    "InboundOrder",
    "InboundOrderLine",
    "InboundStatus",
    "OutboundOrder",
    "OutboundOrderLine",
    "OutboundStatus",
    "PickingTask",
    "PickingTaskLine",
    "PickingStatus",
]
