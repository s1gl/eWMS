from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.models import (
    OutboundOrder,
    OutboundOrderLine,
    OutboundStatus,
    Warehouse,
    Partner,
    Item,
)
from app.schemas import (
    OutboundOrderCreate,
    OutboundOrderRead,
    OutboundOrderStatusUpdate,
)

router = APIRouter(prefix="/outbound_orders", tags=["outbound_orders"])


async def _get_outbound_with_lines(
    session: AsyncSession, order_id: int
) -> OutboundOrder | None:
    return await session.get(
        OutboundOrder,
        order_id,
        options=[selectinload(OutboundOrder.lines)],
    )


@router.post(
    "", response_model=OutboundOrderRead, status_code=status.HTTP_201_CREATED
)
async def create_outbound_order(
    payload: OutboundOrderCreate, session: AsyncSession = Depends(get_session)
):
    warehouse = await session.get(Warehouse, payload.warehouse_id)
    if warehouse is None:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    if payload.partner_id is not None:
        partner = await session.get(Partner, payload.partner_id)
        if partner is None:
            raise HTTPException(status_code=404, detail="Partner not found")

    item_ids = {line.item_id for line in payload.lines}
    if item_ids:
        existing_items = (
            await session.execute(select(Item.id).where(Item.id.in_(item_ids)))
        ).scalars().all()
        missing = item_ids - set(existing_items)
        if missing:
            raise HTTPException(
                status_code=404, detail=f"Items not found: {', '.join(map(str, missing))}"
            )

    order = OutboundOrder(
        external_number=payload.external_number,
        warehouse_id=payload.warehouse_id,
        partner_id=payload.partner_id,
        status=payload.status,
    )
    order.lines = [
        OutboundOrderLine(
            item_id=line.item_id,
            ordered_qty=line.ordered_qty,
            picked_qty=0,
            shipped_qty=0,
        )
        for line in payload.lines
    ]

    session.add(order)
    await session.commit()
    await session.refresh(order)
    await session.refresh(order, attribute_names=["lines"])
    return order


@router.get("", response_model=list[OutboundOrderRead])
async def list_outbound_orders(
    warehouse_id: int | None = None,
    status_filter: OutboundStatus | None = None,
    partner_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(OutboundOrder).options(selectinload(OutboundOrder.lines))
    if warehouse_id:
        stmt = stmt.where(OutboundOrder.warehouse_id == warehouse_id)
    if status_filter:
        stmt = stmt.where(OutboundOrder.status == status_filter)
    if partner_id:
        stmt = stmt.where(OutboundOrder.partner_id == partner_id)

    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{order_id}", response_model=OutboundOrderRead)
async def get_outbound_order(
    order_id: int, session: AsyncSession = Depends(get_session)
):
    order = await _get_outbound_with_lines(session, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Outbound order not found")
    return order


@router.patch(
    "/{order_id}/status",
    response_model=OutboundOrderRead,
    status_code=status.HTTP_200_OK,
)
async def update_outbound_status(
    order_id: int,
    payload: OutboundOrderStatusUpdate,
    session: AsyncSession = Depends(get_session),
):
    order = await _get_outbound_with_lines(session, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Outbound order not found")

    transitions = {
        OutboundStatus.draft: {OutboundStatus.picking, OutboundStatus.cancelled},
        OutboundStatus.picking: {OutboundStatus.packed, OutboundStatus.cancelled},
        OutboundStatus.packed: {OutboundStatus.shipped, OutboundStatus.cancelled},
        OutboundStatus.shipped: set(),
        OutboundStatus.cancelled: set(),
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
