from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.inventory import Inventory
from app.models.item import Item
from app.models.movement import Movement
from app.models.warehouse import Location, Warehouse
from app.schemas import InboundCreate, InventoryRead, MoveCreate
from app.services.inventory import increment_inventory

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post(
    "/inbound",
    response_model=InventoryRead,
    status_code=status.HTTP_201_CREATED,
)
async def inventory_inbound(
    payload: InboundCreate,
    session: AsyncSession = Depends(get_session),
):
    inv = await increment_inventory(
        session,
        warehouse_id=payload.warehouse_id,
        location_id=payload.location_id,
        item_id=payload.item_id,
        qty=payload.qty,
    )

    movement = Movement(
        warehouse_id=payload.warehouse_id,
        item_id=payload.item_id,
        from_location_id=None,
        to_location_id=payload.location_id,
        quantity=payload.qty,
    )
    session.add(movement)

    await session.commit()
    await session.refresh(inv)
    return inv


@router.post("/move")
async def inventory_move(
    payload: MoveCreate,
    session: AsyncSession = Depends(get_session),
):
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot move to same location",
        )

    from_loc = await session.get(Location, payload.from_location_id)
    to_loc = await session.get(Location, payload.to_location_id)

    if not from_loc or not to_loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Location not found"
        )

    from_inv = (
        await session.execute(
            select(Inventory).where(
                Inventory.warehouse_id == payload.warehouse_id,
                Inventory.location_id == payload.from_location_id,
                Inventory.item_id == payload.item_id,
            )
        )
    ).scalar_one_or_none()

    if not from_inv or from_inv.quantity < payload.qty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough quantity on source location",
        )

    to_inv = (
        await session.execute(
            select(Inventory).where(
                Inventory.location_id == payload.to_location_id,
                Inventory.item_id == payload.item_id,
                Inventory.warehouse_id == payload.warehouse_id,
            )
        )
    ).scalar_one_or_none()

    from_inv.quantity -= payload.qty

    if to_inv is None:
        to_inv = Inventory(
            warehouse_id=payload.warehouse_id,
            location_id=payload.to_location_id,
            item_id=payload.item_id,
            quantity=payload.qty,
        )
        session.add(to_inv)
    else:
        to_inv.quantity += payload.qty

    move_record = Movement(
        warehouse_id=payload.warehouse_id,
        item_id=payload.item_id,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        quantity=payload.qty,
    )
    session.add(move_record)

    await session.commit()
    return {"status": "ok"}


@router.get("", response_model=list[InventoryRead])
async def list_inventory(
    warehouse_id: int | None = None,
    location_id: int | None = None,
    item_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Inventory)

    if warehouse_id:
        stmt = stmt.where(Inventory.warehouse_id == warehouse_id)
    if location_id:
        stmt = stmt.where(Inventory.location_id == location_id)
    if item_id:
        stmt = stmt.where(Inventory.item_id == item_id)

    result = await session.execute(stmt)
    return result.scalars().all()

