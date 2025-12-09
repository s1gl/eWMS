import pytest


@pytest.mark.asyncio
async def test_inbound_receive_with_tare(client):
    # warehouse and zones
    wh = (await client.post("/warehouses", json={"name": "WH", "code": "WH1"})).json()
    inbound_zone = (
        await client.post(
            "/zones",
            json={
                "name": "Inbound",
                "code": "IN",
                "warehouse_id": wh["id"],
                "zone_type": "inbound",
            },
        )
    ).json()
    loc = (
        await client.post(
            "/locations",
            json={
                "warehouse_id": wh["id"],
                "zone_id": inbound_zone["id"],
                "code": "IN-01",
                "description": None,
            },
        )
    ).json()

    # item
    item = (
        await client.post(
            "/items", json={"sku": "SKU-1", "name": "Item 1", "unit": "pcs"}
        )
    ).json()

    # tare type and tare
    tare_type = (
        await client.post(
            "/tares/types",
            json={"code": "PAL", "name": "Pallet", "prefix": "PAL", "level": 1},
        )
    ).json()
    tare = (
        await client.post(
            "/tares",
            json={
                "warehouse_id": wh["id"],
                "type_id": tare_type["id"],
                "location_id": None,
                "parent_tare_id": None,
            },
        )
    ).json()

    # inbound order
    order = (
        await client.post(
            "/inbound_orders",
            json={
                "external_number": "EXT-1",
                "warehouse_id": wh["id"],
                "lines": [{"item_id": item["id"], "expected_qty": 5, "received_qty": 0}],
            },
        )
    ).json()
    line_id = order["lines"][0]["id"]

    # move to in_progress
    await client.patch(
        f"/inbound_orders/{order['id']}/status",
        json={"status": "in_progress"},
    )

    # receive
    resp = await client.post(
        f"/inbound_orders/{order['id']}/receive",
        json={
            "line_id": line_id,
            "location_id": loc["id"],
            "qty": 3,
            "tare_id": tare["id"],
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["lines"][0]["received_qty"] == 3

    # tare items
    ti_resp = await client.get(f"/tares/{tare['id']}/items")
    assert ti_resp.status_code == 200
    ti = ti_resp.json()
    assert len(ti) == 1
    assert ti[0]["quantity"] == 3
    assert ti[0]["item_id"] == item["id"]

    # inventory should reflect tare_id
    inv_resp = await client.get("/inventory", params={"warehouse_id": wh["id"]})
    inv = inv_resp.json()
    assert inv[0]["quantity"] == 3


@pytest.mark.asyncio
async def test_inbound_receive_requires_existing_tare(client):
    wh = (await client.post("/warehouses", json={"name": "WH", "code": "WH2"})).json()
    inbound_zone = (
        await client.post(
            "/zones",
            json={
                "name": "Inbound",
                "code": "IN2",
                "warehouse_id": wh["id"],
                "zone_type": "inbound",
            },
        )
    ).json()
    loc = (
        await client.post(
            "/locations",
            json={
                "warehouse_id": wh["id"],
                "zone_id": inbound_zone["id"],
                "code": "IN-02",
                "description": None,
            },
        )
    ).json()
    item = (
        await client.post(
            "/items", json={"sku": "SKU-2", "name": "Item 2", "unit": "pcs"}
        )
    ).json()
    order = (
        await client.post(
            "/inbound_orders",
            json={
                "external_number": "EXT-2",
                "warehouse_id": wh["id"],
                "lines": [{"item_id": item["id"], "expected_qty": 1, "received_qty": 0}],
            },
        )
    ).json()
    line_id = order["lines"][0]["id"]
    await client.patch(
        f"/inbound_orders/{order['id']}/status",
        json={"status": "in_progress"},
    )
    resp = await client.post(
        f"/inbound_orders/{order['id']}/receive",
        json={
            "line_id": line_id,
            "location_id": loc["id"],
            "qty": 1,
            "tare_id": 9999,
        },
    )
    assert resp.status_code == 404
    assert "Tare not found" in resp.text


@pytest.mark.asyncio
async def test_inbound_receive_requires_inbound_zone(client):
    wh = (await client.post("/warehouses", json={"name": "WH", "code": "WH3"})).json()
    storage_zone = (
        await client.post(
            "/zones",
            json={
                "name": "Storage",
                "code": "ST",
                "warehouse_id": wh["id"],
                "zone_type": "storage",
            },
        )
    ).json()
    loc = (
        await client.post(
            "/locations",
            json={
                "warehouse_id": wh["id"],
                "zone_id": storage_zone["id"],
                "code": "ST-01",
                "description": None,
            },
        )
    ).json()
    item = (
        await client.post(
            "/items", json={"sku": "SKU-3", "name": "Item 3", "unit": "pcs"}
        )
    ).json()
    tare_type = (
        await client.post(
            "/tares/types",
            json={"code": "BOX", "name": "Box", "prefix": "BOX", "level": 2},
        )
    ).json()
    tare = (
        await client.post(
            "/tares",
            json={
                "warehouse_id": wh["id"],
                "type_id": tare_type["id"],
                "location_id": None,
                "parent_tare_id": None,
            },
        )
    ).json()
    order = (
        await client.post(
            "/inbound_orders",
            json={
                "external_number": "EXT-3",
                "warehouse_id": wh["id"],
                "lines": [{"item_id": item["id"], "expected_qty": 1, "received_qty": 0}],
            },
        )
    ).json()
    line_id = order["lines"][0]["id"]
    await client.patch(
        f"/inbound_orders/{order['id']}/status",
        json={"status": "in_progress"},
    )
    resp = await client.post(
        f"/inbound_orders/{order['id']}/receive",
        json={
            "line_id": line_id,
            "location_id": loc["id"],
            "qty": 1,
            "tare_id": tare["id"],
        },
    )
    assert resp.status_code == 400
    assert "зоны приёмки" in resp.json()["detail"]
