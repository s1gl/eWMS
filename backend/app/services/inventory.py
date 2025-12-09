from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Inventory
from app.models.item import Item
from app.models.warehouse import Location, Warehouse
from fastapi import HTTPException, status


async def increment_inventory(
    session: AsyncSession,
    warehouse_id: int,
    location_id: int,
    item_id: int,
    qty: int,
    tare_id: int | None = None,
) -> Inventory:
    if qty <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than zero",
        )

    warehouse = await session.get(Warehouse, warehouse_id)
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    location = await session.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if location.warehouse_id != warehouse_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Location not in warehouse"
        )

    item = await session.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    inv = (
        await session.execute(
            select(Inventory).where(
                Inventory.warehouse_id == warehouse_id,
                Inventory.location_id == location_id,
                Inventory.item_id == item_id,
            )
        )
    ).scalar_one_or_none()

    if inv is None:
        inv = Inventory(
            warehouse_id=warehouse_id,
            location_id=location_id,
            item_id=item_id,
            tare_id=tare_id,
            quantity=qty,
        )
        session.add(inv)
    else:
        inv.quantity += qty
        if tare_id is not None:
            inv.tare_id = tare_id

    return inv
