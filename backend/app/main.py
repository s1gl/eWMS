from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.warehouse import Warehouse, Zone, Location
from app.models.item import Item
from app.models.inventory import Inventory
from app.db.session import get_session


# ---------------- APP + CORS ----------------------

app = FastAPI(title="WMS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ---------------- SCHEMAS ----------------------

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


class ZoneCreate(BaseModel):
    name: str
    code: str
    warehouse_id: int


class ZoneRead(BaseModel):
    id: int
    name: str
    code: str
    warehouse_id: int

    class Config:
        from_attributes = True


class LocationCreate(BaseModel):
    warehouse_id: int
    code: str
    zone_id: Optional[int] = None
    description: Optional[str] = None


class LocationRead(BaseModel):
    id: int
    warehouse_id: int
    zone_id: Optional[int] = None
    code: str
    description: Optional[str] = None
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


class InboundCreate(BaseModel):
    warehouse_id: int
    location_id: int
    item_id: int
    qty: int


class MoveCreate(BaseModel):
    warehouse_id: int
    from_location_id: int
    to_location_id: int
    item_id: int
    qty: int


class InventoryRead(BaseModel):
    id: int
    warehouse_id: int
    location_id: int
    item_id: int
    quantity: int

    class Config:
        from_attributes = True


# ---------------- WAREHOUSES ----------------------

@app.post("/warehouses", response_model=WarehouseRead)
async def create_warehouse(
    payload: WarehouseCreate,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Warehouse).where(Warehouse.code == payload.code)
    )
    if result.scalar_one_or_none():
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
async def list_warehouses(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Warehouse))
    return result.scalars().all()


# ---------------- ZONES ----------------------

@app.post("/zones", response_model=ZoneRead)
async def create_zone(
    payload: ZoneCreate,
    session: AsyncSession = Depends(get_session),
):
    warehouse = (
        await session.execute(
            select(Warehouse).where(Warehouse.id == payload.warehouse_id)
        )
    ).scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=400, detail="Warehouse not found")

    zone = Zone(
        name=payload.name,
        code=payload.code,
        warehouse_id=payload.warehouse_id,
    )
    session.add(zone)
    await session.commit()
    await session.refresh(zone)
    return zone


@app.get("/zones", response_model=List[ZoneRead])
async def list_zones(
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Zone)
    if warehouse_id:
        stmt = stmt.where(Zone.warehouse_id == warehouse_id)

    result = await session.execute(stmt)
    return result.scalars().all()


# ---------------- LOCATIONS ----------------------

@app.post("/locations", response_model=LocationRead)
async def create_location(
    payload: LocationCreate,
    session: AsyncSession = Depends(get_session),
):
    warehouse = (
        await session.execute(
            select(Warehouse).where(Warehouse.id == payload.warehouse_id)
        )
    ).scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=400, detail="Warehouse not found")

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


@app.get("/locations", response_model=List[LocationRead])
async def list_locations(
    warehouse_id: Optional[int] = None,
    zone_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Location)

    if warehouse_id:
        stmt = stmt.where(Location.warehouse_id == warehouse_id)
    if zone_id:
        stmt = stmt.where(Location.zone_id == zone_id)

    result = await session.execute(stmt)
    return result.scalars().all()


# ---------------- ITEMS ----------------------

@app.post("/items", response_model=ItemRead)
async def create_item(
    payload: ItemCreate,
    session: AsyncSession = Depends(get_session),
):
    existing = (
        await session.execute(select(Item).where(Item.sku == payload.sku))
    ).scalar_one_or_none()
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
async def list_items(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Item))
    return result.scalars().all()


# ---------------- INVENTORY: INBOUND ----------------------

@app.post("/inventory/inbound", response_model=InventoryRead)
async def inventory_inbound(
    payload: InboundCreate,
    session: AsyncSession = Depends(get_session),
):
    if payload.qty <= 0:
        raise HTTPException(status_code=400, detail="qty must be > 0")

    # Проверяем склад, ячейку и товар
    warehouse = (
        await session.execute(
            select(Warehouse).where(Warehouse.id == payload.warehouse_id)
        )
    ).scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=400, detail="Warehouse not found")

    location = (
        await session.execute(
            select(Location).where(Location.id == payload.location_id)
        )
    ).scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=400, detail="Location not found")

    item = (
        await session.execute(select(Item).where(Item.id == payload.item_id))
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=400, detail="Item not found")

    # Ищем остаток
    inv = (
        await session.execute(
            select(Inventory).where(
                Inventory.warehouse_id == payload.warehouse_id,
                Inventory.location_id == payload.location_id,
                Inventory.item_id == payload.item_id,
            )
        )
    ).scalar_one_or_none()

    if inv is None:
        inv = Inventory(
            warehouse_id=payload.warehouse_id,
            location_id=payload.location_id,
            item_id=payload.item_id,
            quantity=payload.qty,
        )
        session.add(inv)
    else:
        inv.quantity += payload.qty

    await session.commit()
    await session.refresh(inv)
    return inv


# ---------------- INVENTORY: MOVE ----------------------

@app.post("/inventory/move")
async def inventory_move(
    payload: MoveCreate,
    session: AsyncSession = Depends(get_session),
):
    if payload.qty <= 0:
        raise HTTPException(status_code=400, detail="qty must be > 0")

    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(
            status_code=400, detail="Cannot move to same location"
        )

    # Проверяем, что обе ячейки есть
    from_loc = (
        await session.execute(
            select(Location).where(Location.id == payload.from_location_id)
        )
    ).scalar_one_or_none()
    to_loc = (
        await session.execute(
            select(Location).where(Location.id == payload.to_location_id)
        )
    ).scalar_one_or_none()

    if not from_loc or not to_loc:
        raise HTTPException(status_code=400, detail="Location not found")

    # Проверяем остатки
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
            status_code=400,
            detail="Not enough quantity on source location",
        )

    # Ищем запись на целевой ячейке
    to_inv = (
        await session.execute(
            select(Inventory).where(
                Inventory.location_id == payload.to_location_id,
                Inventory.item_id == payload.item_id,
                Inventory.warehouse_id == payload.warehouse_id,
            )
        )
    ).scalar_one_or_none()

    # Списываем
    from_inv.quantity -= payload.qty

    # Добавляем на новую ячейку
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

    await session.commit()
    return {"status": "ok"}


# ---------------- INVENTORY LIST ----------------------

@app.get("/inventory", response_model=List[InventoryRead])
async def list_inventory(
    warehouse_id: Optional[int] = None,
    location_id: Optional[int] = None,
    item_id: Optional[int] = None,
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
