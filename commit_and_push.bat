@echo off
echo Проверка статуса git...
git status --short

echo.
echo Добавление всех изменений...
git add .

echo.
echo Создание коммита...
git commit -m "Improve test suite for warehouses and inventory endpoints

- Add comprehensive tests for /warehouses endpoint (create, list, validation)
- Add comprehensive tests for /inventory/inbound endpoint (inbound, accumulate, validation, error cases)
- Fix status code assertions (201 for POST /warehouses)
- Add tests for missing fields validation
- Add tests for not found errors (404)
- Add test for quantity accumulation on repeated inbound
- All tests use in-memory SQLite test database"

echo.
echo Отправка изменений в удаленный репозиторий...
git push

echo.
echo Готово!
pause

