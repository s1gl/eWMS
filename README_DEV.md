## Новые сущности и ручки

### Zone.zone_type
- Добавлен enum `zone_type` с ролями: `inbound`, `storage`, `outbound`.
- Обязателен при создании зоны (`POST /zones`), обновляется через `PATCH /zones/{id}`.

### Тары
- Модели:
  - `TareType` (код, имя, префикс для индекса, уровень вложенности).
  - `Tare` (уникальный `tare_code`, ссылки на склад/ячейку/родителя, тип, статус).
  - `TareItem` (привязка товара к таре, количество).
- Генерация `tare_code`: сервис `app/services/tare_code.py` создаёт индекс вида `<prefix>-000001`.

### Эндпоинты `/tares`
- `GET /tares/types` — список типов тары.
- `POST /tares/types` — создание типа тары.
- `GET /tares` — список тар (фильтры `warehouse_id`, `location_id`).
- `GET /tares/{id}` — детали тары.
- `POST /tares` — создание тары (генерация `tare_code` внутри).

### Инвентарь
- В `inventory` добавлен nullable `tare_id` (для будущей привязки остатков к таре).

### Миграция
- `backend/migrations/versions/7c3f9b1a2f90_add_tare_and_zone_type.py` создаёт таблицы `tare_types`, `tares`, `tare_items`, поле `zone_type` и `inventory.tare_id`.
