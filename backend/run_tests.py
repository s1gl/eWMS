#!/usr/bin/env python
"""Скрипт для запуска тестов через Docker или локально."""
import subprocess
import sys
import os
import shutil

def check_docker():
    """Проверяет доступность Docker."""
    return shutil.which("docker") is not None

def run_tests_docker():
    """Запускает тесты через Docker."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(project_root)
    
    # Проверяем, запущен ли контейнер
    check_result = subprocess.run(
        ["docker", "compose", "ps", "-q", "backend"],
        capture_output=True,
        text=True
    )
    
    if not check_result.stdout.strip():
        print("Контейнер backend не запущен. Запускаю...")
        subprocess.run(["docker", "compose", "up", "-d", "backend"], check=True)
        import time
        time.sleep(2)  # Даем время контейнеру запуститься
    
    # Устанавливаем зависимости для тестов в контейнере
    print("Установка зависимостей для тестов в Docker контейнере...")
    subprocess.run([
        "docker", "compose", "exec", "-T", "backend",
        "pip", "install", "-q", "pytest", "pytest-asyncio", "httpx", "aiosqlite"
    ], check=False)
    
    # Запускаем тесты
    print("Запуск тестов...")
    result = subprocess.run([
        "docker", "compose", "exec", "-T", "backend",
        "pytest", "tests/", "-v", "--tb=short"
    ])
    return result.returncode

def run_tests_local():
    """Запускает тесты локально."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    # Проверяем зависимости
    try:
        import pytest
        import sqlalchemy
        import httpx
    except ImportError as e:
        print(f"Ошибка: отсутствует модуль {e.name}")
        print("Установите зависимости: pip install -r requirements.txt")
        return 1
    
    # Запускаем тесты
    result = subprocess.run([
        sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"
    ])
    return result.returncode

def main():
    """Главная функция."""
    if check_docker():
        print("Используется Docker для запуска тестов...")
        return run_tests_docker()
    else:
        print("Docker не найден, запуск тестов локально...")
        return run_tests_local()

if __name__ == "__main__":
    sys.exit(main())
