from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.models import (
    Inventory,
    Movement,
    OutboundOrder,
    OutboundOrderLine,
    OutboundStatus,
    PickingStatus,
    PickingTask,
    PickingTaskLine,
)
from app.schemas import (
    PickingTaskRead,
    PickingTaskCompleteLine,
)

router = APIRouter(prefix="/picking_tasks", tags=["picking_tasks"])


async def _get_task_with_lines(
    session: AsyncSession, task_id: int
) -> PickingTask | None:
    return await session.get(
        PickingTask, task_id, options=[selectinload(PickingTask.lines)]
    )


@router.post(
    "/generate",
    response_model=PickingTaskRead,
    status_code=status.HTTP_201_CREATED,
)
async def generate_picking_task(
    outbound_order_id: int, session: AsyncSession = Depends(get_session)
):
    order = await session.get(
        OutboundOrder,
        outbound_order_id,
        options=[selectinload(OutboundOrder.lines)],
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Outbound order not found")

    if not order.lines:
        raise HTTPException(status_code=400, detail="Outbound order has no lines")

    task_lines: list[PickingTaskLine] = []

    for line in order.lines:
        qty_needed = line.ordered_qty - line.picked_qty
        if qty_needed <= 0:
            continue

        inventory_rows = (
            await session.execute(
                select(Inventory).where(
                    Inventory.warehouse_id == order.warehouse_id,
                    Inventory.item_id == line.item_id,
                    Inventory.quantity > 0,
                )
            )
        ).scalars().all()

        for inv in inventory_rows:
            take = min(qty_needed, inv.quantity)
            task_lines.append(
                PickingTaskLine(
                    item_id=line.item_id,
                    from_location_id=inv.location_id,
                    qty_to_pick=take,
                    qty_picked=0,
                )
            )
            qty_needed -= take
            if qty_needed <= 0:
                break

        if qty_needed > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough inventory to pick item {line.item_id}",
            )

    if not task_lines:
        raise HTTPException(status_code=400, detail="No items to pick")

    task = PickingTask(
        warehouse_id=order.warehouse_id,
        outbound_order_id=order.id,
        status=PickingStatus.new,
        lines=task_lines,
    )

    if order.status == OutboundStatus.draft:
        order.status = OutboundStatus.picking

    session.add(task)
    await session.commit()
    await session.refresh(task)
    await session.refresh(task, attribute_names=["lines"])
    return task


@router.get("", response_model=list[PickingTaskRead])
async def list_picking_tasks(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(PickingTask).options(selectinload(PickingTask.lines))
    )
    return result.scalars().all()


@router.get("/{task_id}", response_model=PickingTaskRead)
async def get_picking_task(task_id: int, session: AsyncSession = Depends(get_session)):
    task = await _get_task_with_lines(session, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Picking task not found")
    return task


@router.post(
    "/{task_id}/complete_line",
    response_model=PickingTaskRead,
    status_code=status.HTTP_200_OK,
)
async def complete_picking_line(
    task_id: int,
    payload: PickingTaskCompleteLine,
    session: AsyncSession = Depends(get_session),
):
    task = await _get_task_with_lines(session, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Picking task not found")

    line = next((ln for ln in task.lines if ln.id == payload.line_id), None)
    if line is None:
        raise HTTPException(status_code=404, detail="Picking line not found")

    remaining = line.qty_to_pick - line.qty_picked
    if payload.qty_picked > remaining:
        raise HTTPException(
            status_code=400, detail="Picked quantity exceeds required amount"
        )

    inv = (
        await session.execute(
            select(Inventory).where(
                Inventory.warehouse_id == task.warehouse_id,
                Inventory.location_id == line.from_location_id,
                Inventory.item_id == line.item_id,
            )
        )
    ).scalar_one_or_none()
    if inv is None or inv.quantity < payload.qty_picked:
        raise HTTPException(
            status_code=400, detail="Not enough inventory at source location"
        )

    inv.quantity -= payload.qty_picked
    line.qty_picked += payload.qty_picked

    order = await session.get(
        OutboundOrder,
        task.outbound_order_id,
        options=[selectinload(OutboundOrder.lines)],
    )
    if order:
        target_line = next(
            (ln for ln in order.lines if ln.item_id == line.item_id), None
        )
        if target_line:
            if target_line.picked_qty + payload.qty_picked > target_line.ordered_qty:
                raise HTTPException(
                    status_code=400, detail="Picked quantity exceeds ordered"
                )
            target_line.picked_qty += payload.qty_picked

    movement = Movement(
        warehouse_id=task.warehouse_id,
        item_id=line.item_id,
        from_location_id=line.from_location_id,
        to_location_id=None,
        quantity=payload.qty_picked,
    )
    session.add(movement)

    # обновление статуса задачи
    if all(ln.qty_picked >= ln.qty_to_pick for ln in task.lines):
        task.status = PickingStatus.done
    else:
        task.status = PickingStatus.in_progress

    await session.commit()
    await session.refresh(task)
    await session.refresh(task, attribute_names=["lines"])
    return task
