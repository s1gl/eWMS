#!/bin/bash
# Скрипт для запуска тестов через Docker
set -e

echo "Установка зависимостей для тестов..."
docker compose exec backend pip install -q pytest pytest-asyncio httpx aiosqlite

echo "Запуск тестов..."
docker compose exec backend pytest tests/ -v --tb=short

