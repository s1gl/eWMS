import pytest
from httpx import AsyncClient


async def _create_base_entities(client: AsyncClient):
    wh = await client.post("/warehouses", json={"name": "WH", "code": "WH_INB"})
    warehouse_id = wh.json()["id"]
    loc = await client.post("/locations", json={"warehouse_id": warehouse_id, "code": "LOC_INB"})
    location_id = loc.json()["id"]
    item = await client.post("/items", json={"sku": "SKU_INB", "name": "Item", "unit": "pcs"})
    item_id = item.json()["id"]
    partner = await client.post("/partners", json={"name": "Supplier", "code": "SUP_INB", "type": "supplier", "is_active": True})
    partner_id = partner.json()["id"]
    return warehouse_id, location_id, item_id, partner_id


@pytest.mark.asyncio
async def test_create_and_get_inbound_order(client: AsyncClient):
    warehouse_id, location_id, item_id, partner_id = await _create_base_entities(client)

    payload = {
        "external_number": "INB-1",
        "warehouse_id": warehouse_id,
        "partner_id": partner_id,
        "status": "draft",
        "lines": [
            {
                "item_id": item_id,
                "expected_qty": 5,
                "received_qty": 5,
                "location_id": location_id,
            }
        ],
    }
    resp = await client.post("/inbound_orders", json=payload)
    assert resp.status_code == 201
    order = resp.json()
    assert order["external_number"] == "INB-1"
    assert len(order["lines"]) == 1

    detail = await client.get(f"/inbound_orders/{order['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == order["id"]


@pytest.mark.asyncio
async def test_inbound_status_transition_and_inventory(client: AsyncClient):
    warehouse_id, location_id, item_id, partner_id = await _create_base_entities(client)

    resp = await client.post(
        "/inbound_orders",
        json={
            "external_number": "INB-2",
            "warehouse_id": warehouse_id,
            "partner_id": partner_id,
            "status": "draft",
            "lines": [
                {
                    "item_id": item_id,
                    "expected_qty": 3,
                    "received_qty": 3,
                    "location_id": location_id,
                }
            ],
        },
    )
    order = resp.json()

    to_in_progress = await client.patch(
        f"/inbound_orders/{order['id']}/status", json={"status": "in_progress"}
    )
    assert to_in_progress.status_code == 200
    assert to_in_progress.json()["status"] == "in_progress"

    to_completed = await client.patch(
        f"/inbound_orders/{order['id']}/status", json={"status": "completed"}
    )
    assert to_completed.status_code == 200
    assert to_completed.json()["status"] == "completed"

    inv = await client.get("/inventory", params={"warehouse_id": warehouse_id, "location_id": location_id, "item_id": item_id})
    data = inv.json()
    assert len(data) == 1
    assert data[0]["quantity"] == 3


@pytest.mark.asyncio
async def test_receive_inbound_line_updates_inventory(client: AsyncClient):
    warehouse_id, location_id, item_id, partner_id = await _create_base_entities(client)

    resp = await client.post(
        "/inbound_orders",
        json={
            "external_number": "INB-REC",
            "warehouse_id": warehouse_id,
            "partner_id": partner_id,
            "status": "draft",
            "lines": [
                {
                    "item_id": item_id,
                    "expected_qty": 5,
                    "received_qty": 0,
                    "location_id": location_id,
                }
            ],
        },
    )
    order = resp.json()
    line_id = order["lines"][0]["id"]

    await client.patch(
        f"/inbound_orders/{order['id']}/status", json={"status": "in_progress"}
    )

    receive = await client.post(
        f"/inbound_orders/{order['id']}/receive",
        json={"line_id": line_id, "location_id": location_id, "qty": 3},
    )
    assert receive.status_code == 200
    updated = receive.json()
    line = next(l for l in updated["lines"] if l["id"] == line_id)
    assert line["received_qty"] == 3
    assert line["line_status"] in ("partially_received", "fully_received")

    inv = await client.get(
        "/inventory",
        params={"warehouse_id": warehouse_id, "location_id": location_id, "item_id": item_id},
    )
    data = inv.json()
    assert len(data) == 1
    assert data[0]["quantity"] == 3
