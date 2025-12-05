import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_item(client: AsyncClient):
    """Тест создания товара."""
    payload = {"sku": "SKU001", "name": "Test Item", "unit": "pcs"}
    response = await client.post("/items", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "SKU001"
    assert data["name"] == "Test Item"
    assert data["unit"] == "pcs"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_create_item_duplicate_sku(client: AsyncClient):
    """Тест создания товара с дублирующимся SKU."""
    payload = {"sku": "SKU001", "name": "Test Item", "unit": "pcs"}
    await client.post("/items", json=payload)
    
    # Попытка создать второй товар с тем же SKU
    response = await client.post("/items", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_items(client: AsyncClient):
    """Тест получения списка товаров."""
    await client.post("/items", json={"sku": "SKU1", "name": "Item 1", "unit": "pcs"})
    await client.post("/items", json={"sku": "SKU2", "name": "Item 2", "unit": "pcs"})
    
    response = await client.get("/items")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

