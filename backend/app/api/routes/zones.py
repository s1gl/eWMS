from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.warehouse import Warehouse, Zone, ZoneType
from app.schemas import ZoneCreate, ZoneRead, ZoneUpdate

router = APIRouter(prefix="/zones", tags=["zones"])


@router.post("", response_model=ZoneRead, status_code=status.HTTP_201_CREATED)
async def create_zone(
    payload: ZoneCreate,
    session: AsyncSession = Depends(get_session),
):
    warehouse = await session.get(Warehouse, payload.warehouse_id)
    if warehouse is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found"
        )

    zone = Zone(
        name=payload.name,
        code=payload.code,
        warehouse_id=payload.warehouse_id,
        zone_type=ZoneType(payload.zone_type),
    )
    session.add(zone)
    await session.commit()
    await session.refresh(zone)
    return zone


@router.get("", response_model=list[ZoneRead])
async def list_zones(
    warehouse_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Zone)
    if warehouse_id:
        stmt = stmt.where(Zone.warehouse_id == warehouse_id)

    result = await session.execute(stmt)
    return result.scalars().all()


@router.patch("/{zone_id}", response_model=ZoneRead)
async def update_zone(
    zone_id: int, payload: ZoneUpdate, session: AsyncSession = Depends(get_session)
):
    zone = await session.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    if payload.warehouse_id is not None:
        warehouse = await session.get(Warehouse, payload.warehouse_id)
        if warehouse is None:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        zone.warehouse_id = payload.warehouse_id
    if payload.name is not None:
        zone.name = payload.name
    if payload.code is not None:
        zone.code = payload.code
    if payload.zone_type is not None:
        zone.zone_type = ZoneType(payload.zone_type)

    await session.commit()
    await session.refresh(zone)
    return zone


@router.delete("/{zone_id}")
async def delete_zone(zone_id: int, session: AsyncSession = Depends(get_session)):
    zone = await session.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    await session.delete(zone)
    await session.commit()
    return {"status": "deleted"}

