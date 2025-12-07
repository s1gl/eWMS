import pytest
from httpx import AsyncClient


async def _setup_entities(client: AsyncClient):
    wh = await client.post("/warehouses", json={"name": "WH", "code": "WH_OUT"})
    warehouse_id = wh.json()["id"]
    item = await client.post("/items", json={"sku": "SKU_OUT", "name": "Item", "unit": "pcs"})
    item_id = item.json()["id"]
    partner = await client.post("/partners", json={"name": "Customer", "code": "CUST_OUT", "type": "customer", "is_active": True})
    partner_id = partner.json()["id"]
    return warehouse_id, item_id, partner_id


@pytest.mark.asyncio
async def test_create_outbound_order(client: AsyncClient):
    warehouse_id, item_id, partner_id = await _setup_entities(client)

    resp = await client.post(
        "/outbound_orders",
        json={
            "external_number": "OUT-1",
            "warehouse_id": warehouse_id,
            "partner_id": partner_id,
            "status": "draft",
            "lines": [{"item_id": item_id, "ordered_qty": 2}],
        },
    )
    assert resp.status_code == 201
    order = resp.json()
    assert order["external_number"] == "OUT-1"
    assert len(order["lines"]) == 1


@pytest.mark.asyncio
async def test_outbound_status_transitions(client: AsyncClient):
    warehouse_id, item_id, partner_id = await _setup_entities(client)

    resp = await client.post(
        "/outbound_orders",
        json={
            "external_number": "OUT-2",
            "warehouse_id": warehouse_id,
            "partner_id": partner_id,
            "status": "draft",
            "lines": [{"item_id": item_id, "ordered_qty": 1}],
        },
    )
    order = resp.json()

    to_picking = await client.patch(
        f"/outbound_orders/{order['id']}/status", json={"status": "picking"}
    )
    assert to_picking.status_code == 200
    assert to_picking.json()["status"] == "picking"

    to_packed = await client.patch(
        f"/outbound_orders/{order['id']}/status", json={"status": "packed"}
    )
    assert to_packed.status_code == 200
    assert to_packed.json()["status"] == "packed"

    to_shipped = await client.patch(
        f"/outbound_orders/{order['id']}/status", json={"status": "shipped"}
    )
    assert to_shipped.status_code == 200
    assert to_shipped.json()["status"] == "shipped"
