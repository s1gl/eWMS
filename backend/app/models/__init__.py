# backend/app/models/__init__.py
from app.db.base import Base  # чтобы Alembic видел Base

from .user import User
from .warehouse import Warehouse, Zone, Location
from .item import Item
from .inventory import Inventory
from .movement import Movement

__all__ = [
    "Base",
    "User",
    "Warehouse",
    "Zone",
    "Location",
    "Item",
    "Inventory",
    "Movement",
]
