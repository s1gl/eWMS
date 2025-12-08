# pgAdmin в docker-compose

## Доступ
- UI: http://localhost:5050
- Логин: `admin@ewms.ru`
- Пароль: `admin`

## Настройка сервера в pgAdmin
Внутри pgAdmin добавьте сервер со следующими параметрами (вкладка Connection):
- Name: `eWMS Postgres` (любое имя)
- Host: `db` (имя сервиса в docker-compose, доступно внутри сети docker)
- Port: `5432`
- Maintenance DB: `wms`
- Username: `wms`
- Password: `wms_password`

Volumes для pgAdmin настроены (`pgadmin_data:/var/lib/pgadmin`), так что список серверов сохранится между рестартами контейнера.
