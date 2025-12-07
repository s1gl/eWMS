import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_partner(client: AsyncClient):
    payload = {"name": "Supplier A", "code": "SUP1", "type": "supplier", "is_active": True}
    resp = await client.post("/partners", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "SUP1"
    assert data["type"] == "supplier"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_create_partner_duplicate_code(client: AsyncClient):
    payload = {"name": "Partner", "code": "P001", "type": "customer", "is_active": True}
    await client.post("/partners", json=payload)
    resp = await client.post("/partners", json=payload)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_filter_partners(client: AsyncClient):
    await client.post("/partners", json={"name": "Cust", "code": "C1", "type": "customer", "is_active": True})
    await client.post("/partners", json={"name": "Supp", "code": "S1", "type": "supplier", "is_active": False})

    resp = await client.get("/partners", params={"type": "customer"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(p["type"] == "customer" for p in data)

    resp = await client.get("/partners", params={"is_active": False})
    assert resp.status_code == 200
    data = resp.json()
    assert all(p["is_active"] is False for p in data)
