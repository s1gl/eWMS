from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.models import (
    InboundOrder,
    InboundOrderLine,
    InboundStatus,
    InboundReceipt,
    Inventory,
    Movement,
    Warehouse,
    Partner,
    Item,
    Location,
    Tare,
    TareItem,
    ZoneType,
    TareStatus,
)
from app.schemas import (
    InboundOrderCreate,
    InboundOrderRead,
    InboundOrderStatusUpdate,
    InboundReceiveRequest,
    InboundCloseTareRequest,
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


def _recalculate_order_status(order: InboundOrder) -> None:
    """
    Update order status based on line facts.
    """
    has_mis_sort = any(
        ln.line_status == "mis_sort" or ln.expected_qty == 0 for ln in order.lines
    )
    has_over = any(ln.received_qty > ln.expected_qty for ln in order.lines if ln.expected_qty is not None)
    all_match = (
        len(order.lines) > 0
        and not has_mis_sort
        and not has_over
        and all(
            (ln.received_qty or 0) == (ln.expected_qty or 0)
            for ln in order.lines
            if ln.expected_qty is not None
        )
    )

    if has_mis_sort:
        order.status = InboundStatus.mis_sort
    elif has_over:
        order.status = InboundStatus.problem
    elif all_match:
        order.status = InboundStatus.received
    else:
        order.status = InboundStatus.receiving


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

    status_value = payload.status or InboundStatus.ready_for_receiving
    order = InboundOrder(
        external_number=payload.external_number,
        warehouse_id=payload.warehouse_id,
        partner_id=payload.partner_id,
        status=status_value,
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
        InboundStatus.ready_for_receiving: {InboundStatus.receiving, InboundStatus.cancelled},
        InboundStatus.receiving: {
            InboundStatus.received,
            InboundStatus.cancelled,
            InboundStatus.problem,
            InboundStatus.mis_sort,
        },
        InboundStatus.problem: {InboundStatus.receiving, InboundStatus.cancelled, InboundStatus.received},
        InboundStatus.mis_sort: {InboundStatus.receiving, InboundStatus.cancelled, InboundStatus.received},
        InboundStatus.received: set(),
        InboundStatus.cancelled: set(),
        # legacy compatibility
        InboundStatus.draft: {InboundStatus.receiving, InboundStatus.cancelled},
        InboundStatus.in_progress: {
            InboundStatus.received,
            InboundStatus.cancelled,
            InboundStatus.problem,
            InboundStatus.mis_sort,
        },
        InboundStatus.completed: set(),
    }

    if payload.status == order.status:
        return order

    allowed = transitions.get(order.status, set())
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status transition")

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
        InboundStatus.receiving,
        InboundStatus.problem,
        InboundStatus.mis_sort,
        InboundStatus.in_progress,
    }:
        raise HTTPException(status_code=400, detail="Order must be in receiving to accept items")

    tare = await session.get(Tare, payload.tare_id)
    if tare is None:
        raise HTTPException(status_code=404, detail="Tare not found")
    if tare.warehouse_id != order.warehouse_id:
        raise HTTPException(status_code=400, detail="Tare does not belong to order warehouse")
    if tare.status == TareStatus.closed:
        raise HTTPException(status_code=400, detail="Tare is already closed for receiving")

    line = None
    if payload.line_id:
        line = next((ln for ln in order.lines if ln.id == payload.line_id), None)
        if line is None:
            raise HTTPException(status_code=404, detail="Line not found in this order")
    elif payload.item_id:
        line = next((ln for ln in order.lines if ln.item_id == payload.item_id), None)

    actual_item_id = payload.item_id or (line.item_id if line else None)
    if actual_item_id is None:
        raise HTTPException(status_code=400, detail="Item is required to receive")

    item = await session.get(Item, actual_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    if line is None:
        line = InboundOrderLine(
            item_id=actual_item_id,
            expected_qty=0,
            received_qty=payload.qty,
            location_id=None,
            line_status="mis_sort",
        )
        order.lines.append(line)
    else:
        line.received_qty += payload.qty
        if line.received_qty > line.expected_qty:
            line.line_status = "over_received"
        elif payload.condition:
            line.line_status = payload.condition.value if hasattr(payload.condition, "value") else str(payload.condition)
        if line.line_status not in {"mis_sort", "over_received"}:
            if line.received_qty == line.expected_qty:
                line.line_status = "fully_received"
            elif line.received_qty > 0:
                line.line_status = "partially_received"

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

    receipt = InboundReceipt(
        inbound_order_id=order.id,
        line_id=line.id if line else None,
        tare_id=tare.id,
        item_id=actual_item_id,
        quantity=payload.qty,
        condition=payload.condition,
    )
    session.add(receipt)

    _recalculate_order_status(order)
    await session.commit()
    await session.refresh(order)
    await session.refresh(order, attribute_names=["lines"])
    return order


@router.post("/{order_id}/close_tare", response_model=InboundOrderRead)
async def close_tare_after_receiving(
    order_id: int,
    payload: InboundCloseTareRequest,
    session: AsyncSession = Depends(get_session),
):
    order = await _get_inbound_with_lines(session, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Inbound order not found")
    if order.status not in {
        InboundStatus.receiving,
        InboundStatus.problem,
        InboundStatus.mis_sort,
        InboundStatus.in_progress,
    }:
        raise HTTPException(status_code=400, detail="Order must be in receiving to close tare")

    tare = await session.get(Tare, payload.tare_id)
    if tare is None:
        raise HTTPException(status_code=404, detail="Tare not found")
    if tare.warehouse_id != order.warehouse_id:
        raise HTTPException(status_code=400, detail="Tare does not belong to order warehouse")
    if tare.status == TareStatus.closed:
        raise HTTPException(status_code=400, detail="Tare already closed")
    if tare.location_id:
        raise HTTPException(status_code=400, detail="Tare already placed to a location")

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
            detail="Принимать можно только в ячейки зоны приёмки",
        )

    # move tare and update inventory by its items
    await session.refresh(tare, attribute_names=["items"])
    tare.location_id = payload.location_id
    for ti in tare.items:
        await increment_inventory(
            session,
            warehouse_id=order.warehouse_id,
            location_id=payload.location_id,
            item_id=ti.item_id,
            qty=ti.quantity,
            tare_id=tare.id,
        )

    tare.status = TareStatus.closed
    _recalculate_order_status(order)
    await session.commit()
    await session.refresh(order)
    await session.refresh(order, attribute_names=["lines"])
    return order
