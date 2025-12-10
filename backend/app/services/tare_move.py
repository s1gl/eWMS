from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Inventory, Location, Tare, TareItem


async def _load_location_with_zone(session: AsyncSession, location_id: int) -> Location | None:
    return (
        await session.execute(
            select(Location)
            .options(selectinload(Location.zone))
            .where(Location.id == location_id)
        )
    ).scalar_one_or_none()


async def move_tare(
    session: AsyncSession,
    tare_id: int,
    target_location_id: int,
    *,
    allowed_from_zone_types: list[str] | None = None,
    allowed_to_zone_types: list[str] | None = None,
) -> Tare:
    """
    Move tare with inventory between locations. Validates zone restrictions and updates inventory.
    """
    tare = await session.get(Tare, tare_id)
    if tare is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tare not found")

    target_location = await _load_location_with_zone(session, target_location_id)
    if target_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target location not found",
        )
    if target_location.zone is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target location has no zone assigned",
        )

    if tare.location_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tare is not assigned to a location",
        )

    if tare.location_id == target_location_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tare is already at the specified location",
        )

    source_location = await _load_location_with_zone(session, tare.location_id)
    if source_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source location not found",
        )
    if source_location.zone is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source location has no zone assigned",
        )

    if tare.warehouse_id != target_location.warehouse_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target location is not in tare warehouse",
        )
    if tare.warehouse_id != source_location.warehouse_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source location is not in tare warehouse",
        )

    from_zone_type = (
        source_location.zone.zone_type.value
        if hasattr(source_location.zone.zone_type, "value")
        else str(source_location.zone.zone_type)
    )
    to_zone_type = (
        target_location.zone.zone_type.value
        if hasattr(target_location.zone.zone_type, "value")
        else str(target_location.zone.zone_type)
    )

    if allowed_from_zone_types and from_zone_type not in allowed_from_zone_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tare cannot be moved from this zone",
        )
    if allowed_to_zone_types and to_zone_type not in allowed_to_zone_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tare cannot be moved to this zone",
        )

    await session.refresh(tare, attribute_names=["items"])
    tare_items: Iterable[TareItem] = tare.items or []
    item_ids = [ti.item_id for ti in tare_items]

    if item_ids:
        inv_stmt: Select[Inventory] = select(Inventory).where(
            Inventory.warehouse_id == tare.warehouse_id,
            Inventory.item_id.in_(item_ids),
            Inventory.location_id.in_([tare.location_id, target_location_id]),
        )
        inv_map = {
            (inv.location_id, inv.item_id): inv
            for inv in (await session.execute(inv_stmt)).scalars().all()
        }

        for ti in tare_items:
            source_key = (tare.location_id, ti.item_id)
            target_key = (target_location_id, ti.item_id)
            from_inv = inv_map.get(source_key)
            if from_inv is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Inventory for item {ti.item_id} not found in source location",
                )
            if from_inv.quantity < ti.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Not enough quantity for item {ti.item_id} in source location",
                )

            from_inv.quantity -= ti.quantity
            if from_inv.quantity <= 0:
                await session.delete(from_inv)
                inv_map.pop(source_key, None)

            to_inv = inv_map.get(target_key)
            if to_inv is None:
                to_inv = Inventory(
                    warehouse_id=tare.warehouse_id,
                    location_id=target_location_id,
                    item_id=ti.item_id,
                    tare_id=tare.id,
                    quantity=ti.quantity,
                )
                session.add(to_inv)
                inv_map[target_key] = to_inv
            else:
                to_inv.quantity += ti.quantity
                to_inv.tare_id = tare.id

    tare.location_id = target_location_id
    return tare
