import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_reports_inventory_and_turnover(client: AsyncClient):
    # создаём минимальные данные
    wh = await client.post("/warehouses", json={"name": "WH", "code": "WH_REP"})
    warehouse_id = wh.json()["id"]
    loc = await client.post("/locations", json={"warehouse_id": warehouse_id, "code": "LOC_REP"})
    location_id = loc.json()["id"]
    item = await client.post("/items", json={"sku": "SKU_REP", "name": "Item", "unit": "pcs"})
    item_id = item.json()["id"]

    inbound = await client.post(
        "/inventory/inbound",
        json={
            "warehouse_id": warehouse_id,
            "location_id": location_id,
            "item_id": item_id,
            "qty": 2,
        },
    )
    assert inbound.status_code == 201

    inv_summary = await client.get("/reports/inventory_summary")
    assert inv_summary.status_code == 200
    summary = inv_summary.json()
    assert any(
        row["warehouse_id"] == warehouse_id and row["item_id"] == item_id
        for row in summary
    )

    turnover = await client.get("/reports/inbound_outbound_turnover")
    assert turnover.status_code == 200
    rows = turnover.json()
    assert any(
        row["warehouse_id"] == warehouse_id and row["item_id"] == item_id
        for row in rows
    )
