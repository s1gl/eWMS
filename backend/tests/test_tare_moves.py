import pytest


async def _prepare_inbound_tare(client, qty: int = 5):
    wh = (await client.post("/warehouses", json={"name": "WH", "code": "WH-MOV"})).json()
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
    inbound_loc = (
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
    storage_loc = (
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
            "/items", json={"sku": "SKU-MOV", "name": "Item", "unit": "pcs"}
        )
    ).json()
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
    order = (
        await client.post(
            "/inbound_orders",
            json={
                "external_number": "EXT-MOV",
                "warehouse_id": wh["id"],
                "lines": [
                    {"item_id": item["id"], "expected_qty": qty, "received_qty": 0}
                ],
            },
        )
    ).json()
    await client.patch(
        f"/inbound_orders/{order['id']}/status", json={"status": "in_progress"}
    )
    line_id = order["lines"][0]["id"]
    await client.post(
        f"/inbound_orders/{order['id']}/receive",
        json={
            "line_id": line_id,
            "tare_id": tare["id"],
            "qty": qty,
        },
    )
    await client.post(
        f"/inbound_orders/{order['id']}/close_tare",
        json={"tare_id": tare["id"], "location_id": inbound_loc["id"]},
    )
    return {
        "warehouse": wh,
        "inbound_location": inbound_loc,
        "storage_location": storage_loc,
        "storage_zone": storage_zone,
        "tare": tare,
        "item": item,
        "qty": qty,
    }


@pytest.mark.asyncio
async def test_putaway_moves_from_inbound_to_storage(client):
    ctx = await _prepare_inbound_tare(client, qty=4)
    resp = await client.post(
        f"/tares/{ctx['tare']['id']}/putaway",
        json={"target_location_id": ctx["storage_location"]["id"]},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["location_id"] == ctx["storage_location"]["id"]
    assert data["status"] == "storage"

    inbound_inv = (
        await client.get(
            "/inventory",
            params={
                "warehouse_id": ctx["warehouse"]["id"],
                "location_id": ctx["inbound_location"]["id"],
            },
        )
    ).json()
    assert inbound_inv == []

    storage_inv = (
        await client.get(
            "/inventory",
            params={
                "warehouse_id": ctx["warehouse"]["id"],
                "location_id": ctx["storage_location"]["id"],
            },
        )
    ).json()
    assert len(storage_inv) == 1
    assert storage_inv[0]["quantity"] == ctx["qty"]
    assert storage_inv[0]["location_id"] == ctx["storage_location"]["id"]


@pytest.mark.asyncio
async def test_putaway_requires_inbound_source_zone(client):
    wh = (await client.post("/warehouses", json={"name": "WH", "code": "WH-ZONE"})).json()
    storage_zone = (
        await client.post(
            "/zones",
            json={
                "name": "Storage",
                "code": "ST-ZONE",
                "warehouse_id": wh["id"],
                "zone_type": "storage",
            },
        )
    ).json()
    storage_loc = (
        await client.post(
            "/locations",
            json={
                "warehouse_id": wh["id"],
                "zone_id": storage_zone["id"],
                "code": "ST-ZONE-01",
                "description": None,
            },
        )
    ).json()
    target_loc = (
        await client.post(
            "/locations",
            json={
                "warehouse_id": wh["id"],
                "zone_id": storage_zone["id"],
                "code": "ST-ZONE-02",
                "description": None,
            },
        )
    ).json()
    tare_type = (
        await client.post(
            "/tares/types",
            json={"code": "BOX", "name": "Box", "prefix": "BOX", "level": 1},
        )
    ).json()
    tare = (
        await client.post(
            "/tares",
            json={
                "warehouse_id": wh["id"],
                "type_id": tare_type["id"],
                "location_id": storage_loc["id"],
                "parent_tare_id": None,
            },
        )
    ).json()

    resp = await client.post(
        f"/tares/{tare['id']}/putaway",
        json={"target_location_id": target_loc["id"]},
    )
    assert resp.status_code == 400
    assert "zone" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_move_storage_to_storage_updates_inventory(client):
    ctx = await _prepare_inbound_tare(client, qty=3)

    # first put away to storage A
    await client.post(
        f"/tares/{ctx['tare']['id']}/putaway",
        json={"target_location_id": ctx["storage_location"]["id"]},
    )

    storage_loc_b = (
        await client.post(
            "/locations",
            json={
                "warehouse_id": ctx["warehouse"]["id"],
                "zone_id": ctx["storage_zone"]["id"],
                "code": "ST-02",
                "description": None,
            },
        )
    ).json()

    move_resp = await client.post(
        f"/tares/{ctx['tare']['id']}/move",
        json={"target_location_id": storage_loc_b["id"]},
    )
    assert move_resp.status_code == 200, move_resp.text
    moved = move_resp.json()
    assert moved["location_id"] == storage_loc_b["id"]

    # source storage should be cleared, destination should accumulate
    storage_a_inv = (
        await client.get(
            "/inventory",
            params={
                "warehouse_id": ctx["warehouse"]["id"],
                "location_id": ctx["storage_location"]["id"],
            },
        )
    ).json()
    assert storage_a_inv == []

    storage_b_inv = (
        await client.get(
            "/inventory",
            params={
                "warehouse_id": ctx["warehouse"]["id"],
                "location_id": storage_loc_b["id"],
            },
        )
    ).json()
    assert len(storage_b_inv) == 1
    assert storage_b_inv[0]["quantity"] == ctx["qty"]
