from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.warehouse import Warehouse
from app.models.item import Item
from app.db.session import get_session

app = FastAPI(title="WMS API")


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ---------- SCHEMAS ----------


class WarehouseCreate(BaseModel):
    name: str
    code: str


class WarehouseRead(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool

    class Config:
        from_attributes = True


class ItemCreate(BaseModel):
    sku: str
    name: str
    barcode: Optional[str] = None
    unit: str = "pcs"


class ItemRead(BaseModel):
    id: int
    sku: str
    name: str
    barcode: Optional[str] = None
    unit: str
    is_active: bool

    class Config:
        from_attributes = True


# ---------- WAREHOUSES API ----------


@app.post("/warehouses", response_model=WarehouseRead)
async def create_warehouse(
    payload: WarehouseCreate,
    session: AsyncSession = Depends(get_session),
):
    # Проверяем уникальность кода склада
    result = await session.execute(
        select(Warehouse).where(Warehouse.code == payload.code)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Warehouse with code '{payload.code}' already exists",
        )

    warehouse = Warehouse(name=payload.name, code=payload.code)
    session.add(warehouse)
    await session.commit()
    await session.refresh(warehouse)
    return warehouse


@app.get("/warehouses", response_model=List[WarehouseRead])
async def list_warehouses(
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Warehouse))
    warehouses = result.scalars().all()
    return warehouses


# ---------- ITEMS API ----------


@app.post("/items", response_model=ItemRead)
async def create_item(
    payload: ItemCreate,
    session: AsyncSession = Depends(get_session),
):
    # Проверяем уникальность SKU
    result = await session.execute(select(Item).where(Item.sku == payload.sku))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Item with sku '{payload.sku}' already exists",
        )

    item = Item(
        sku=payload.sku,
        name=payload.name,
        barcode=payload.barcode,
        unit=payload.unit,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@app.get("/items", response_model=List[ItemRead])
async def list_items(
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Item))
    items = result.scalars().all()
    return items
