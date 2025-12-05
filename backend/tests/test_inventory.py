import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_inventory_inbound(client: AsyncClient):
    """Тест прихода товара на склад."""
    # Создаём необходимые сущности
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH001"}
    )
    assert warehouse_resp.status_code == 201
    warehouse_id = warehouse_resp.json()["id"]
    
    location_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC001"},
    )
    assert location_resp.status_code == 200
    location_id = location_resp.json()["id"]
    
    item_resp = await client.post(
        "/items", json={"sku": "SKU001", "name": "Item", "unit": "pcs"}
    )
    assert item_resp.status_code == 200
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
    assert "id" in data


@pytest.mark.asyncio
async def test_inventory_inbound_accumulate(client: AsyncClient):
    """Тест накопления количества при повторном приходе."""
    # Создаём необходимые сущности
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH_ACC"}
    )
    warehouse_id = warehouse_resp.json()["id"]
    
    location_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC_ACC"},
    )
    location_id = location_resp.json()["id"]
    
    item_resp = await client.post(
        "/items", json={"sku": "SKU_ACC", "name": "Item", "unit": "pcs"}
    )
    item_id = item_resp.json()["id"]
    
    # Первый приход
    payload = {
        "warehouse_id": warehouse_id,
        "location_id": location_id,
        "item_id": item_id,
        "qty": 10,
    }
    response1 = await client.post("/inventory/inbound", json=payload)
    assert response1.status_code == 201
    assert response1.json()["quantity"] == 10
    
    # Второй приход того же товара
    response2 = await client.post("/inventory/inbound", json=payload)
    assert response2.status_code == 201
    assert response2.json()["quantity"] == 20  # Должно накопиться
    
    # Проверяем через GET /inventory
    inv_response = await client.get("/inventory", params={"item_id": item_id})
    assert inv_response.status_code == 200
    inventory = inv_response.json()
    assert len(inventory) == 1
    assert inventory[0]["quantity"] == 20


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
    
    # Невалидное количество: 0
    payload = {
        "warehouse_id": warehouse_id,
        "location_id": location_id,
        "item_id": item_id,
        "qty": 0,
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 422  # Validation error
    
    # Невалидное количество: отрицательное
    payload["qty"] = -5
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_inventory_inbound_missing_fields(client: AsyncClient):
    """Тест прихода с отсутствующими полями."""
    # Отсутствует qty
    payload = {
        "warehouse_id": 1,
        "location_id": 1,
        "item_id": 1,
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 422
    
    # Отсутствует warehouse_id
    payload = {
        "location_id": 1,
        "item_id": 1,
        "qty": 10,
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_inventory_inbound_warehouse_not_found(client: AsyncClient):
    """Тест прихода с несуществующим складом."""
    # Создаём location и item
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH_NF"}
    )
    warehouse_id = warehouse_resp.json()["id"]
    
    location_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC_NF"},
    )
    location_id = location_resp.json()["id"]
    
    item_resp = await client.post(
        "/items", json={"sku": "SKU_NF", "name": "Item", "unit": "pcs"}
    )
    item_id = item_resp.json()["id"]
    
    # Пытаемся использовать несуществующий склад
    payload = {
        "warehouse_id": 99999,  # Несуществующий ID
        "location_id": location_id,
        "item_id": item_id,
        "qty": 10,
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 404
    assert "warehouse" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_inventory_inbound_location_not_found(client: AsyncClient):
    """Тест прихода с несуществующей ячейкой."""
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH_LOC_NF"}
    )
    warehouse_id = warehouse_resp.json()["id"]
    
    item_resp = await client.post(
        "/items", json={"sku": "SKU_LOC_NF", "name": "Item", "unit": "pcs"}
    )
    item_id = item_resp.json()["id"]
    
    # Пытаемся использовать несуществующую ячейку
    payload = {
        "warehouse_id": warehouse_id,
        "location_id": 99999,  # Несуществующий ID
        "item_id": item_id,
        "qty": 10,
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 404
    assert "location" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_inventory_inbound_item_not_found(client: AsyncClient):
    """Тест прихода с несуществующим товаром."""
    warehouse_resp = await client.post(
        "/warehouses", json={"name": "WH", "code": "WH_ITEM_NF"}
    )
    warehouse_id = warehouse_resp.json()["id"]
    
    location_resp = await client.post(
        "/locations",
        json={"warehouse_id": warehouse_id, "code": "LOC_ITEM_NF"},
    )
    location_id = location_resp.json()["id"]
    
    # Пытаемся использовать несуществующий товар
    payload = {
        "warehouse_id": warehouse_id,
        "location_id": location_id,
        "item_id": 99999,  # Несуществующий ID
        "qty": 10,
    }
    response = await client.post("/inventory/inbound", json=payload)
    assert response.status_code == 404
    assert "item" in response.json()["detail"].lower()


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

