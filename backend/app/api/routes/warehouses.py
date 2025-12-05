from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.warehouse import Warehouse
from app.schemas import WarehouseCreate, WarehouseRead

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.post("", response_model=WarehouseRead, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    payload: WarehouseCreate,
    session: AsyncSession = Depends(get_session),
):
    existing = (
        await session.execute(select(Warehouse).where(Warehouse.code == payload.code))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Warehouse with code '{payload.code}' already exists",
        )

    warehouse = Warehouse(name=payload.name, code=payload.code)
    session.add(warehouse)
    await session.commit()
    await session.refresh(warehouse)
    return warehouse


@router.get("", response_model=list[WarehouseRead])
async def list_warehouses(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Warehouse))
    return result.scalars().all()

