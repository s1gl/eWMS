#!/bin/bash
# Скрипт для запуска тестов через Docker
docker compose run --rm backend pytest tests/ -v --tb=short

