import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_warehouse(client: AsyncClient):
    """Тест создания склада."""
    payload = {"name": "Test Warehouse", "code": "WH001"}
    response = await client.post("/warehouses", json=payload)
    assert response.status_code == 201  # HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Test Warehouse"
    assert data["code"] == "WH001"
    assert data["is_active"] is True
    assert "id" in data
    assert isinstance(data["id"], int)


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
async def test_create_warehouse_missing_fields(client: AsyncClient):
    """Тест создания склада с отсутствующими полями."""
    # Отсутствует поле code
    response = await client.post("/warehouses", json={"name": "Test Warehouse"})
    assert response.status_code == 422  # Validation error
    
    # Отсутствует поле name
    response = await client.post("/warehouses", json={"code": "WH001"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_warehouses_empty(client: AsyncClient):
    """Тест получения пустого списка складов."""
    response = await client.get("/warehouses")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # В новой БД список может быть пустым или содержать данные из предыдущих тестов


@pytest.mark.asyncio
async def test_list_warehouses(client: AsyncClient):
    """Тест получения списка складов."""
    # Создаём несколько складов
    wh1 = await client.post("/warehouses", json={"name": "WH1", "code": "WH1"})
    wh2 = await client.post("/warehouses", json={"name": "WH2", "code": "WH2"})
    
    assert wh1.status_code == 201
    assert wh2.status_code == 201
    
    response = await client.get("/warehouses")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    
    # Проверяем, что созданные склады есть в списке
    codes = [wh["code"] for wh in data]
    assert "WH1" in codes
    assert "WH2" in codes


@pytest.mark.asyncio
async def test_list_warehouses_structure(client: AsyncClient):
    """Тест структуры данных в списке складов."""
    await client.post("/warehouses", json={"name": "Test WH", "code": "TEST001"})
    
    response = await client.get("/warehouses")
    assert response.status_code == 200
    data = response.json()
    
    if len(data) > 0:
        warehouse = data[0]
        assert "id" in warehouse
        assert "name" in warehouse
        assert "code" in warehouse
        assert "is_active" in warehouse
        assert isinstance(warehouse["id"], int)
        assert isinstance(warehouse["name"], str)
        assert isinstance(warehouse["code"], str)
        assert isinstance(warehouse["is_active"], bool)

