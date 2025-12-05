import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_inventory_inbound(client: AsyncClient):
    """Тест прихода товара на склад."""
    # Создаём необходимые сущности
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH001"}
    )
    warehouse_id = warehouse_resp.json()["id"]
    
    location_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC001"},
    )
    location_id = location_resp.json()["id"]
    
    item_resp = await client.post(
        "/items", json={"sku": "SKU001", "name": "Item", "unit": "pcs"}
    )
    item_id = item_resp.json()["id"]
    
    # Приход товара
    payload = {
        "warehouse_id": warehouse_id,
        "location_id": location_id,
        "item_id": item_id,
        "qty": 10,
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["quantity"] == 10
    assert data["warehouse_id"] == warehouse_id
    assert data["location_id"] == location_id
    assert data["item_id"] == item_id


@pytest.mark.asyncio
async def test_inventory_inbound_invalid_qty(client: AsyncClient):
    """Тест прихода с невалидным количеством."""
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH002"}
    )
    warehouse_id = warehouse_resp.json()["id"]
    
    location_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC002"},
    )
    location_id = location_resp.json()["id"]
    
    item_resp = await client.post(
        "/items", json={"sku": "SKU002", "name": "Item", "unit": "pcs"}
    )
    item_id = item_resp.json()["id"]
    
    payload = {
        "warehouse_id": warehouse_id,
        "location_id": location_id,
        "item_id": item_id,
        "qty": 0,  # Невалидное количество
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_inventory_move(client: AsyncClient):
    """Тест перемещения товара между ячейками."""
    # Создаём необходимые сущности
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH003"}
    )
    warehouse_id = warehouse_resp.json()["id"]
    
    loc1_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC003A"},
    )
    loc1_id = loc1_resp.json()["id"]
    
    loc2_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC003B"},
    )
    loc2_id = loc2_resp.json()["id"]
    
    item_resp = await client.post(
        "/items", json={"sku": "SKU003", "name": "Item", "unit": "pcs"}
    )
    item_id = item_resp.json()["id"]
    
    # Приход на первую ячейку
    await client.post(
        "/inventory/inbound",
        json={
            "warehouse_id": warehouse_id,
            "location_id": loc1_id,
            "item_id": item_id,
            "qty": 20,
        },
    )
    
    # Перемещение
    payload = {
        "warehouse_id": warehouse_id,
        "from_location_id": loc1_id,
        "to_location_id": loc2_id,
        "item_id": item_id,
        "qty": 10,
    }
    response = await client.post("/inventory/move", json=payload)
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    
    # Проверяем остатки
    inv_response = await client.get("/inventory")
    assert inv_response.status_code == 200
    inventory = inv_response.json()
    
    loc1_inv = next((inv for inv in inventory if inv["location_id"] == loc1_id), None)
    loc2_inv = next((inv for inv in inventory if inv["location_id"] == loc2_id), None)
    
    assert loc1_inv is not None
    assert loc1_inv["quantity"] == 10
    assert loc2_inv is not None
    assert loc2_inv["quantity"] == 10

