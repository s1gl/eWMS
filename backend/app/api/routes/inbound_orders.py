from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.models import (
    InboundOrder,
    InboundOrderLine,
    InboundStatus,
    Inventory,
    Movement,
    Warehouse,
    Partner,
    Item,
    Location,
    Tare,
    TareItem,
    ZoneType,
)
from app.schemas import (
    InboundOrderCreate,
    InboundOrderRead,
    InboundOrderStatusUpdate,
    InboundReceiveRequest,
)
from app.services.inventory import increment_inventory

router = APIRouter(prefix="/inbound_orders", tags=["inbound_orders"])


async def _get_inbound_with_lines(
    session: AsyncSession, order_id: int
) -> InboundOrder | None:
    return await session.get(
        InboundOrder,
        order_id,
        options=[selectinload(InboundOrder.lines)],
    )


@router.post("", response_model=InboundOrderRead, status_code=status.HTTP_201_CREATED)
async def create_inbound_order(
    payload: InboundOrderCreate, session: AsyncSession = Depends(get_session)
):
    warehouse = await session.get(Warehouse, payload.warehouse_id)
    if warehouse is None:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    if payload.partner_id is not None:
        partner = await session.get(Partner, payload.partner_id)
        if partner is None:
            raise HTTPException(status_code=404, detail="Partner not found")

    # validate items and optional locations
    item_ids = {line.item_id for line in payload.lines}
    locations = {line.location_id for line in payload.lines if line.location_id}

    if item_ids:
        existing_items = (
            await session.execute(select(Item.id).where(Item.id.in_(item_ids)))
        ).scalars().all()
        missing = item_ids - set(existing_items)
        if missing:
            raise HTTPException(
                status_code=404, detail=f"Items not found: {', '.join(map(str, missing))}"
            )

    if locations:
        existing_locations = (
            await session.execute(select(Location).where(Location.id.in_(locations)))
        ).scalars().all()
        existing_map = {loc.id: loc for loc in existing_locations}
        missing_locs = locations - set(existing_map.keys())
        if missing_locs:
            raise HTTPException(
                status_code=404,
                detail=f"Locations not found: {', '.join(map(str, missing_locs))}",
            )
        for loc in existing_locations:
            if loc.warehouse_id != payload.warehouse_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Location {loc.id} does not belong to warehouse {payload.warehouse_id}",
                )

    order = InboundOrder(
        external_number=payload.external_number,
        warehouse_id=payload.warehouse_id,
        partner_id=payload.partner_id,
        status=InboundStatus.draft,
    )
    order.lines = []
    for line in payload.lines:
        order.lines.append(
            InboundOrderLine(
                item_id=line.item_id,
                expected_qty=line.expected_qty,
                received_qty=line.received_qty,
                location_id=line.location_id,
                line_status=line.line_status or "open",
            )
        )

    session.add(order)
    await session.commit()
    await session.refresh(order)
    await session.refresh(order, attribute_names=["lines"])
    return order


@router.get("", response_model=list[InboundOrderRead])
async def list_inbound_orders(
    warehouse_id: int | None = None,
    status_filter: InboundStatus | None = None,
    partner_id: int | None = None,
    external_number: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(InboundOrder).options(selectinload(InboundOrder.lines))
    if warehouse_id:
        stmt = stmt.where(InboundOrder.warehouse_id == warehouse_id)
    if status_filter:
        stmt = stmt.where(InboundOrder.status == status_filter)
    if partner_id:
        stmt = stmt.where(InboundOrder.partner_id == partner_id)
    if external_number:
        stmt = stmt.where(InboundOrder.external_number.ilike(f"%{external_number}%"))

    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{order_id}", response_model=InboundOrderRead)
async def get_inbound_order(order_id: int, session: AsyncSession = Depends(get_session)):
    order = await _get_inbound_with_lines(session, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Inbound order not found")
    return order


@router.patch(
    "/{order_id}/status", response_model=InboundOrderRead, status_code=status.HTTP_200_OK
)
async def update_inbound_status(
    order_id: int,
    payload: InboundOrderStatusUpdate,
    session: AsyncSession = Depends(get_session),
):
    order = await _get_inbound_with_lines(session, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Inbound order not found")

    transitions = {
        InboundStatus.draft: {InboundStatus.in_progress, InboundStatus.cancelled},
        InboundStatus.in_progress: {
            InboundStatus.completed,
            InboundStatus.cancelled,
            InboundStatus.problem,
            InboundStatus.mis_sort,
        },
        InboundStatus.problem: {InboundStatus.completed, InboundStatus.cancelled},
        InboundStatus.mis_sort: {InboundStatus.completed, InboundStatus.cancelled},
        InboundStatus.completed: set(),
        InboundStatus.cancelled: set(),
    }

    if payload.status == order.status:
        return order

    allowed = transitions.get(order.status, set())
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status transition")

    # Apply inventory movements when completing
    if payload.status == InboundStatus.completed:
        for line in order.lines:
            qty = line.received_qty or line.expected_qty
            if qty <= 0:
                continue
            if line.location_id is None:
                raise HTTPException(
                    status_code=400,
                    detail="Location is required to complete inbound order",
                )
            location = await session.get(Location, line.location_id)
            if location is None:
                raise HTTPException(status_code=404, detail="Location not found")
            if location.warehouse_id != order.warehouse_id:
                raise HTTPException(
                    status_code=400,
                    detail="Line location does not belong to order warehouse",
                )

            inv = (
                await session.execute(
                    select(Inventory).where(
                        Inventory.warehouse_id == order.warehouse_id,
                        Inventory.location_id == line.location_id,
                        Inventory.item_id == line.item_id,
                    )
                )
            ).scalar_one_or_none()

            if inv is None:
                inv = Inventory(
                    warehouse_id=order.warehouse_id,
                    location_id=line.location_id,
                    item_id=line.item_id,
                    quantity=qty,
                )
                session.add(inv)
            else:
                inv.quantity += qty

            movement = Movement(
                warehouse_id=order.warehouse_id,
                item_id=line.item_id,
                from_location_id=None,
                to_location_id=line.location_id,
                quantity=qty,
            )
            session.add(movement)

    order.status = payload.status
    await session.commit()
    await session.refresh(order)
    await session.refresh(order, attribute_names=["lines"])
    return order


@router.post("/{order_id}/receive", response_model=InboundOrderRead)
async def receive_inbound_line(
    order_id: int,
    payload: InboundReceiveRequest,
    session: AsyncSession = Depends(get_session),
):
    order = await _get_inbound_with_lines(session, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Inbound order not found")
    if order.status not in {
        InboundStatus.in_progress,
        InboundStatus.problem,
        InboundStatus.mis_sort,
    }:
        raise HTTPException(status_code=400, detail="Order must be in progress to receive")

    line = next((ln for ln in order.lines if ln.id == payload.line_id), None)
    if line is None:
        raise HTTPException(status_code=404, detail="Line not found in this order")

    actual_item_id = payload.item_id or line.item_id

    # validate location belongs to warehouse and is inbound zone
    location = (
        await session.execute(
            select(Location).options(selectinload(Location.zone)).where(Location.id == payload.location_id)
        )
    ).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    if location.warehouse_id != order.warehouse_id:
        raise HTTPException(status_code=400, detail="Location not in order warehouse")
    if location.zone is None or location.zone.zone_type != ZoneType.inbound:
        raise HTTPException(
            status_code=400,
            detail="Нельзя принимать товар в ячейку не из зоны приёмки",
        )

    tare = await session.get(Tare, payload.tare_id)
    if tare is None:
        raise HTTPException(status_code=404, detail="Tare not found")
    if tare.warehouse_id != order.warehouse_id:
        raise HTTPException(status_code=400, detail="Tare does not belong to order warehouse")
    tare.location_id = payload.location_id
    tare.warehouse_id = order.warehouse_id

    # validate item exists
    item = await session.get(Item, actual_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    # increment inventory
    await increment_inventory(
        session,
        warehouse_id=order.warehouse_id,
        location_id=payload.location_id,
        item_id=actual_item_id,
        qty=payload.qty,
        tare_id=tare.id,
    )

    tare_item = (
        await session.execute(
            select(TareItem).where(
                TareItem.tare_id == tare.id,
                TareItem.item_id == actual_item_id,
            )
        )
    ).scalar_one_or_none()
    if tare_item is None:
        tare_item = TareItem(
            tare_id=tare.id,
            item_id=actual_item_id,
            quantity=payload.qty,
        )
        session.add(tare_item)
    else:
        tare_item.quantity += payload.qty

    # Если пришёл другой товар — создаём отдельную строку пересорта
    if payload.item_id and payload.item_id != line.item_id:
        mis_line = InboundOrderLine(
            item_id=payload.item_id,
            expected_qty=0,
            received_qty=payload.qty,
            location_id=payload.location_id,
            line_status="mis_sort",
        )
        order.lines.append(mis_line)
        order.status = InboundStatus.mis_sort
    else:
        # persist chosen location on the line to allow completion later
        if not line.location_id:
            line.location_id = payload.location_id

        line.received_qty += payload.qty
        if line.received_qty > line.expected_qty:
            line.line_status = "over_received"
            order.status = InboundStatus.problem
        elif payload.condition:
            line.line_status = payload.condition

        # update line status
        if line.line_status in {"mis_sort", "over_received"}:
            pass
        elif line.received_qty == line.expected_qty:
            line.line_status = "fully_received"
        elif line.received_qty > 0:
            line.line_status = "partially_received"

    await session.commit()
    await session.refresh(order)
    await session.refresh(order, attribute_names=["lines"])
    return order
