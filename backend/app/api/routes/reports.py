from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models import Inventory, Movement

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/inventory_summary")
async def inventory_summary(session: AsyncSession = Depends(get_session)):
    stmt = (
        select(
            Inventory.warehouse_id,
            Inventory.item_id,
            func.sum(Inventory.quantity).label("quantity"),
        )
        .group_by(Inventory.warehouse_id, Inventory.item_id)
    )
    result = await session.execute(stmt)
    rows = result.all()
    return [
        {
            "warehouse_id": row.warehouse_id,
            "item_id": row.item_id,
            "quantity": row.quantity,
        }
        for row in rows
    ]


@router.get("/inbound_outbound_turnover")
async def inbound_outbound_turnover(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
):
    inbound_case = case(
        (
            (Movement.from_location_id.is_(None)),
            Movement.quantity,
        ),
        else_=0,
    )
    outbound_case = case(
        (
            (Movement.to_location_id.is_(None)),
            Movement.quantity,
        ),
        else_=0,
    )

    stmt = select(
        Movement.warehouse_id,
        Movement.item_id,
        func.sum(inbound_case).label("inbound_qty"),
        func.sum(outbound_case).label("outbound_qty"),
    ).group_by(Movement.warehouse_id, Movement.item_id)

    if start_date:
        stmt = stmt.where(Movement.created_at >= start_date)
    if end_date:
        stmt = stmt.where(Movement.created_at <= end_date)

    result = await session.execute(stmt)
    rows = result.all()
    return [
        {
            "warehouse_id": row.warehouse_id,
            "item_id": row.item_id,
            "inbound_qty": row.inbound_qty,
            "outbound_qty": row.outbound_qty,
        }
        for row in rows
    ]
