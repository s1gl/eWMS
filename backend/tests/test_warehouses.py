import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_warehouse(client: AsyncClient):
    """Тест создания склада."""
    payload = {"name": "Test Warehouse", "code": "WH001"}
    response = await client.post("/warehouses", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Warehouse"
    assert data["code"] == "WH001"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_create_warehouse_duplicate_code(client: AsyncClient):
    """Тест создания склада с дублирующимся кодом."""
    payload = {"name": "Test Warehouse", "code": "WH001"}
    await client.post("/warehouses", json=payload)
    
    # Попытка создать второй склад с тем же кодом
    response = await client.post("/warehouses", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_warehouses(client: AsyncClient):
    """Тест получения списка складов."""
    # Создаём несколько складов
    await client.post("/warehouses", json={"name": "WH1", "code": "WH1"})
    await client.post("/warehouses", json={"name": "WH2", "code": "WH2"})
    
    response = await client.get("/warehouses")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

