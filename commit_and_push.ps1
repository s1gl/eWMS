# Скрипт для коммита и пуша изменений
Set-Location -Path $PSScriptRoot

Write-Host "Проверка статуса git..." -ForegroundColor Cyan
git status --short

Write-Host "`nДобавление всех изменений..." -ForegroundColor Cyan
git add .

Write-Host "`nСоздание коммита..." -ForegroundColor Cyan
git commit -m "Improve test suite for warehouses and inventory endpoints

- Add comprehensive tests for /warehouses endpoint (create, list, validation)
- Add comprehensive tests for /inventory/inbound endpoint (inbound, accumulate, validation, error cases)
- Fix status code assertions (201 for POST /warehouses)
- Add tests for missing fields validation
- Add tests for not found errors (404)
- Add test for quantity accumulation on repeated inbound
- All tests use in-memory SQLite test database"

Write-Host "`nОтправка изменений в удаленный репозиторий..." -ForegroundColor Cyan
git push

Write-Host "`nГотово!" -ForegroundColor Green

