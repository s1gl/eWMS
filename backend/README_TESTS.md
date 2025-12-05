# Запуск тестов

## Через Docker (рекомендуется)

```bash
# Установить зависимости для тестов (если еще не установлены)
docker compose exec backend pip install pytest pytest-asyncio httpx aiosqlite

# Запустить тесты
docker compose exec backend pytest tests/ -v --tb=short

# Или через docker compose run
docker compose run --rm backend pytest tests/ -v --tb=short
```

## Локально

1. Создать виртуальное окружение:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows
```

2. Установить зависимости:
```bash
pip install -r requirements.txt
```

3. Запустить тесты:
```bash
pytest tests/ -v --tb=short
```

## Структура тестов

- `tests/conftest.py` - конфигурация pytest и фикстуры
- `tests/test_health.py` - тесты health check эндпоинта
- `tests/test_warehouses.py` - тесты для складов
- `tests/test_items.py` - тесты для товаров
- `tests/test_inventory.py` - тесты для инвентаризации

