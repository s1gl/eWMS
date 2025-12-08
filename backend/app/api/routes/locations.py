from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.warehouse import Location, Warehouse, Zone
from app.schemas import LocationCreate, LocationRead, LocationUpdate

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post("", response_model=LocationRead, status_code=status.HTTP_200_OK)
async def create_location(
    payload: LocationCreate,
    session: AsyncSession = Depends(get_session),
):
    warehouse = await session.get(Warehouse, payload.warehouse_id)
    if warehouse is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found"
        )

    location = Location(
        warehouse_id=payload.warehouse_id,
        zone_id=payload.zone_id,
        code=payload.code,
        description=payload.description,
    )

    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


@router.get("", response_model=list[LocationRead])
async def list_locations(
    warehouse_id: int | None = None,
    zone_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Location)

    if warehouse_id:
        stmt = stmt.where(Location.warehouse_id == warehouse_id)
    if zone_id:
        stmt = stmt.where(Location.zone_id == zone_id)

    result = await session.execute(stmt)
    return result.scalars().all()


@router.patch("/{location_id}", response_model=LocationRead)
async def update_location(
    location_id: int,
    payload: LocationUpdate,
    session: AsyncSession = Depends(get_session),
):
    location = await session.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    if payload.warehouse_id is not None:
        warehouse = await session.get(Warehouse, payload.warehouse_id)
        if warehouse is None:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        location.warehouse_id = payload.warehouse_id

    if payload.zone_id is not None:
        if payload.zone_id == 0:
            location.zone_id = None
        else:
            zone = await session.get(Zone, payload.zone_id)
            if zone is None:
                raise HTTPException(status_code=404, detail="Zone not found")
            location.zone_id = payload.zone_id

    if payload.code is not None:
        location.code = payload.code
    if payload.description is not None:
        location.description = payload.description
    if payload.is_active is not None:
        location.is_active = payload.is_active

    await session.commit()
    await session.refresh(location)
    return location


@router.delete("/{location_id}")
async def delete_location(location_id: int, session: AsyncSession = Depends(get_session)):
    location = await session.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    location.is_active = False
    await session.commit()
    return {"status": "deleted"}

