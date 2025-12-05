# Настройка окружения для тестов

## Вариант 1: Через Docker (рекомендуется)

### Требования
- Docker Desktop должен быть запущен

### Шаги

1. Запустите Docker Desktop

2. Запустите контейнеры:
```bash
docker compose up -d backend
```

3. Установите зависимости для тестов:
```bash
docker compose exec backend pip install pytest pytest-asyncio httpx aiosqlite
```

4. Запустите тесты:
```bash
docker compose exec backend pytest tests/ -v --tb=short
```

Или используйте скрипт:
```bash
python backend/run_tests.py
```

## Вариант 2: Локально (без Docker)

### Требования
- Python 3.8+ (рекомендуется 3.9-3.11, так как Python 3.14 может иметь проблемы с pip)

### Шаги

1. Установите зависимости:
```bash
cd backend
pip install -r requirements.txt
```

2. Запустите тесты:
```bash
pytest tests/ -v --tb=short
```

### Примечание для Python 3.14

Если у вас Python 3.14 и возникают проблемы с pip в виртуальном окружении:

1. Используйте системный Python без venv:
```bash
pip install --user pytest pytest-asyncio httpx aiosqlite fastapi uvicorn asyncpg SQLAlchemy python-dotenv alembic psycopg2-binary
pytest tests/ -v --tb=short
```

2. Или используйте Docker (Вариант 1)

## Структура тестов

- `tests/conftest.py` - конфигурация pytest и фикстуры (тестовая БД в памяти)
- `tests/test_health.py` - тесты health check эндпоинта
- `tests/test_warehouses.py` - тесты для складов
- `tests/test_items.py` - тесты для товаров  
- `tests/test_inventory.py` - тесты для инвентаризации

## Запуск конкретных тестов

```bash
# Только health check
pytest tests/test_health.py -v

# Только склады
pytest tests/test_warehouses.py -v

# Конкретный тест
pytest tests/test_warehouses.py::test_create_warehouse -v
```

