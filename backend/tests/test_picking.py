import pytest
from httpx import AsyncClient


async def _prepare_inventory(client: AsyncClient, qty: int = 5):
    wh = await client.post("/warehouses", json={"name": "WH", "code": "WH_PICK"})
    warehouse_id = wh.json()["id"]
    loc = await client.post("/locations", json={"warehouse_id": warehouse_id, "code": "LOC_PICK"})
    location_id = loc.json()["id"]
    item = await client.post("/items", json={"sku": "SKU_PICK", "name": "Item", "unit": "pcs"})
    item_id = item.json()["id"]

    inbound_payload = {
        "warehouse_id": warehouse_id,
        "location_id": location_id,
        "item_id": item_id,
        "qty": qty,
    }
    inbound_resp = await client.post("/inventory/inbound", json=inbound_payload)
    assert inbound_resp.status_code == 201
    return warehouse_id, location_id, item_id


@pytest.mark.asyncio
async def test_generate_and_complete_picking_task(client: AsyncClient):
    warehouse_id, location_id, item_id = await _prepare_inventory(client, qty=4)

    order_resp = await client.post(
        "/outbound_orders",
        json={
            "external_number": "OUT-PICK",
            "warehouse_id": warehouse_id,
            "partner_id": None,
            "status": "draft",
            "lines": [{"item_id": item_id, "ordered_qty": 2}],
        },
    )
    order = order_resp.json()

    task_resp = await client.post(
        f"/picking_tasks/generate?outbound_order_id={order['id']}"
    )
    assert task_resp.status_code == 201
    task = task_resp.json()
    assert task["status"] == "new"
    assert len(task["lines"]) >= 1

    line = task["lines"][0]
    complete_resp = await client.post(
        f"/picking_tasks/{task['id']}/complete_line",
        json={"line_id": line["id"], "qty_picked": line["qty_to_pick"]},
    )
    assert complete_resp.status_code == 200
    task_after = complete_resp.json()
    assert task_after["status"] in ("in_progress", "done")

    inv = await client.get(
        "/inventory",
        params={
            "warehouse_id": warehouse_id,
            "location_id": location_id,
            "item_id": item_id,
        },
    )
    remaining = inv.json()[0]["quantity"]
    assert remaining == 4 - line["qty_to_pick"]
