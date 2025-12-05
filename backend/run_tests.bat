@echo off
docker compose exec backend pytest tests/ -v --tb=short

