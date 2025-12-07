from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.warehouse import Location, Warehouse
from app.schemas import LocationCreate, LocationRead

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

