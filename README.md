# 📦 eWMS — Warehouse Management System (MVP)

**eWMS** — это современная и модульная WMS-система, построенная на **FastAPI + PostgreSQL + React + Docker**, которая позволяет управлять складской логистикой: складами, зонами, ячейками, товарами, остатками и движениями.

Проект спроектирован так, чтобы его можно было расширять: добавить документы (приход, перемещение, отгрузка), пользователей, роли, отчёты, интеграции и мобильный терминал.

---

## 🚀 Возможности (MVP)

- Управление складами: создание, получение
- Управление товарами: создание, просмотр
- Остатки по ячейкам
- Движения товара (приход, перемещение)
- Миграции Alembic
- Swagger /docs
- Полный Docker‑стек (backend + frontend + db + pgAdmin + redis)
- Асинхронный FastAPI backend

---

## 🏗 Технологии

### Backend
- FastAPI
- PostgreSQL
- SQLAlchemy Async
- Alembic
- Redis
- Uvicorn

### Frontend
- React + TypeScript
- Vite

### DevOps
- Docker / Docker Compose

---

## 📁 Структура проекта

```
wms_project/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── main.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic.ini + migrations/
│
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── index.html
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## 🐳 Запуск проекта через Docker

### 1. Собрать и запустить

```bash
docker compose up --build
```

После запуска сервисы доступны:

| Сервис | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |
| PostgreSQL | db:5432 |

---

## 🗄 Миграции Alembic

### Автогенерация миграции:

```bash
docker compose exec backend alembic revision --autogenerate -m "init schema"
```

### Применить миграции:

```bash
docker compose exec backend alembic upgrade head
```

---

## 📡 API (MVP)

### Warehouses
- `POST /warehouses`
- `GET /warehouses`

### Items
- `POST /items`
- `GET /items`

### Inventory
- `POST /inventory/inbound`
- `POST /inventory/move`

### Healthcheck
- `GET /health`

Swagger доступен по адресу:

👉 http://localhost:8000/docs

---

## 🔮 Roadmap
### Stage 1 (сейчас):
- Склады, зоны, ячейки
- Товары
- Остатки
- Перемещения
- Инфраструктура проекта

### Stage 2:
- Авторизация (JWT)
- Роли
- Документы операций
- Расширенные отчёты

### Stage 3:
- Мобильный терминал
- Сканеры штрихкодов
- Интеграции

---

## 📜 License
MIT License

