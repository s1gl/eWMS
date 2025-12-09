from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models import (
    Tare,
    TareItem,
    TareStatus,
    TareType,
    Warehouse,
    Location,
    Item,
)
from app.schemas import (
    TareCreate,
    TareRead,
    TareTypeCreate,
    TareTypeRead,
    TareItemWithItem,
)
from app.services.tare_code import generate_tare_code

router = APIRouter(prefix="/tares", tags=["tares"])


@router.get("/types", response_model=list[TareTypeRead])
async def list_tare_types(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(TareType))
    return result.scalars().all()


@router.post("/types", response_model=TareTypeRead, status_code=status.HTTP_201_CREATED)
async def create_tare_type(
    payload: TareTypeCreate, session: AsyncSession = Depends(get_session)
):
    existing = (
        await session.execute(select(TareType).where(TareType.code == payload.code))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Tare type with this code already exists")
    tare_type = TareType(
        code=payload.code,
        name=payload.name,
        prefix=payload.prefix,
        level=payload.level,
    )
    session.add(tare_type)
    await session.commit()
    await session.refresh(tare_type)
    return tare_type


@router.get("", response_model=list[TareRead])
async def list_tares(
    warehouse_id: int | None = None,
    location_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Tare)
    if warehouse_id:
        stmt = stmt.where(Tare.warehouse_id == warehouse_id)
    if location_id:
        stmt = stmt.where(Tare.location_id == location_id)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{tare_id}", response_model=TareRead)
async def get_tare(tare_id: int, session: AsyncSession = Depends(get_session)):
    tare = await session.get(Tare, tare_id)
    if tare is None:
        raise HTTPException(status_code=404, detail="Tare not found")
    return tare


@router.get("/{tare_id}/items", response_model=list[TareItemWithItem])
async def list_tare_items(tare_id: int, session: AsyncSession = Depends(get_session)):
    tare = await session.get(Tare, tare_id)
    if tare is None:
        raise HTTPException(status_code=404, detail="Tare not found")
    result = await session.execute(
        select(TareItem, Item).join(Item, Item.id == TareItem.item_id).where(TareItem.tare_id == tare_id)
    )
    rows = result.all()
    return [
        TareItemWithItem(
            id=ti.id,
            tare_id=ti.tare_id,
            item_id=ti.item_id,
            quantity=ti.quantity,
            item_sku=item.sku,
            item_name=item.name,
            item_unit=item.unit,
        )
        for ti, item in rows
    ]


@router.post("", response_model=TareRead, status_code=status.HTTP_201_CREATED)
async def create_tare(payload: TareCreate, session: AsyncSession = Depends(get_session)):
    warehouse = await session.get(Warehouse, payload.warehouse_id)
    if warehouse is None:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    tare_type = await session.get(TareType, payload.type_id)
    if tare_type is None:
        raise HTTPException(status_code=404, detail="Tare type not found")

    if payload.location_id:
        location = await session.get(Location, payload.location_id)
        if location is None or location.warehouse_id != payload.warehouse_id:
            raise HTTPException(status_code=400, detail="Location not in warehouse")

    if payload.parent_tare_id:
        parent = await session.get(Tare, payload.parent_tare_id)
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent tare not found")

    tare_code = await generate_tare_code(session, tare_type)

    tare = Tare(
        warehouse_id=payload.warehouse_id,
        location_id=payload.location_id,
        type_id=payload.type_id,
        tare_code=tare_code,
        parent_tare_id=payload.parent_tare_id,
        status=TareStatus.inbound,
    )
    session.add(tare)
    await session.commit()
    await session.refresh(tare)
    return tare
