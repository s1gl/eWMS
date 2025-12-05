from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.warehouse import Warehouse, Zone
from app.schemas import ZoneCreate, ZoneRead

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

