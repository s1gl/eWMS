import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createInbound,
  fetchInventory,
  moveInventory,
} from "../api/inventory";
import { fetchWarehouses } from "../api/warehouses";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import {
  InventoryRecord,
  InboundPayload,
  Item,
  Location,
  MovePayload,
  Warehouse,
} from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

type Option = { value: number; label: string };

const toNumberOrNull = (val: string) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
};

export default function InventoryPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);

  const [inboundForm, setInboundForm] = useState({
    warehouse_id: "",
    location_id: "",
    item_id: "",
    qty: "",
  });

  const [moveForm, setMoveForm] = useState({
    warehouse_id: "",
    from_location_id: "",
    to_location_id: "",
    item_id: "",
    qty: "",
  });

  const [filters, setFilters] = useState({
    warehouse_id: "",
    location_id: "",
    item_id: "",
  });

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadBasics = async () => {
      setLoading(true);
      try {
        const [wh, it, loc, inv] = await Promise.all([
          fetchWarehouses(),
          fetchItems(),
          fetchLocations(),
          fetchInventory(),
        ]);
        setWarehouses(wh);
        setItems(it);
        setLocations(loc);
        setInventory(inv);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };
    loadBasics();
  }, []);

  const locationOptionsByWarehouse = useMemo(() => {
    const map = new Map<number, Location[]>();
    locations.forEach((loc) => {
      const existing = map.get(loc.warehouse_id) || [];
      existing.push(loc);
      map.set(loc.warehouse_id, existing);
    });
    return map;
  }, [locations]);

  const handleInboundSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: InboundPayload | null = buildInboundPayload(inboundForm);
    if (!payload) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await createInbound(payload);
      setMessage("Приёмка выполнена");
      await refreshInventory();
    } catch (err: any) {
      setError(err.message || "Ошибка приёмки");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: MovePayload | null = buildMovePayload(moveForm);
    if (!payload) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await moveInventory(payload);
      setMessage("Перемещение выполнено");
      await refreshInventory();
    } catch (err: any) {
      setError(err.message || "Ошибка перемещения");
    } finally {
      setLoading(false);
    }
  };

  const refreshInventory = async () => {
    const params = {
      warehouse_id: toNumberOrNull(filters.warehouse_id) || undefined,
      location_id: toNumberOrNull(filters.location_id) || undefined,
      item_id: toNumberOrNull(filters.item_id) || undefined,
    };
    const data = await fetchInventory(params);
    setInventory(data);
  };

  const warehouseOptions: Option[] = warehouses.map((w) => ({
    value: w.id,
    label: `${w.name} (${w.code})`,
  }));
  const itemOptions: Option[] = items.map((i) => ({
    value: i.id,
    label: `${i.name} (${i.sku})`,
  }));

  return (
    <div className="page">
      <Card title="Остатки / операции">
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid two-cols">
          <form className="form" onSubmit={handleInboundSubmit}>
            <h3>Приёмка</h3>
            <FormField label="Склад">
              <select
                value={inboundForm.warehouse_id}
                onChange={(e) =>
                  setInboundForm((p) => ({ ...p, warehouse_id: e.target.value }))
                }
                required
              >
                <option value="">Выберите склад</option>
                {warehouseOptions.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Ячейка">
              <select
                value={inboundForm.location_id}
                onChange={(e) =>
                  setInboundForm((p) => ({ ...p, location_id: e.target.value }))
                }
                required
              >
                <option value="">Выберите ячейку</option>
                {getLocationOptions(
                  inboundForm.warehouse_id,
                  locationOptionsByWarehouse
                ).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Товар">
              <select
                value={inboundForm.item_id}
                onChange={(e) =>
                  setInboundForm((p) => ({ ...p, item_id: e.target.value }))
                }
                required
              >
                <option value="">Выберите товар</option>
                {itemOptions.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Количество">
              <input
                type="number"
                min={1}
                value={inboundForm.qty}
                onChange={(e) =>
                  setInboundForm((p) => ({ ...p, qty: e.target.value }))
                }
                required
              />
            </FormField>
            <button type="submit" disabled={loading}>
              {loading ? "Выполняю..." : "Приход"}
            </button>
          </form>

          <form className="form" onSubmit={handleMoveSubmit}>
            <h3>Перемещение</h3>
            <FormField label="Склад">
              <select
                value={moveForm.warehouse_id}
                onChange={(e) =>
                  setMoveForm((p) => ({ ...p, warehouse_id: e.target.value }))
                }
                required
              >
                <option value="">Выберите склад</option>
                {warehouseOptions.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Из ячейки">
              <select
                value={moveForm.from_location_id}
                onChange={(e) =>
                  setMoveForm((p) => ({ ...p, from_location_id: e.target.value }))
                }
                required
              >
                <option value="">Выберите ячейку</option>
                {getLocationOptions(
                  moveForm.warehouse_id,
                  locationOptionsByWarehouse
                ).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="В ячейку">
              <select
                value={moveForm.to_location_id}
                onChange={(e) =>
                  setMoveForm((p) => ({ ...p, to_location_id: e.target.value }))
                }
                required
              >
                <option value="">Выберите ячейку</option>
                {getLocationOptions(
                  moveForm.warehouse_id,
                  locationOptionsByWarehouse
                ).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Товар">
              <select
                value={moveForm.item_id}
                onChange={(e) =>
                  setMoveForm((p) => ({ ...p, item_id: e.target.value }))
                }
                required
              >
                <option value="">Выберите товар</option>
                {itemOptions.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Количество">
              <input
                type="number"
                min={1}
                value={moveForm.qty}
                onChange={(e) =>
                  setMoveForm((p) => ({ ...p, qty: e.target.value }))
                }
                required
              />
            </FormField>
            <button type="submit" disabled={loading}>
              {loading ? "Выполняю..." : "Переместить"}
            </button>
          </form>
        </div>

        <Card title="Остатки" actions={<span className="muted">Фильтры</span>}>
          <form
            className="form inline"
            onSubmit={(e) => {
              e.preventDefault();
              refreshInventory();
            }}
          >
            <FormField label="Склад">
              <select
                value={filters.warehouse_id}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, warehouse_id: e.target.value }))
                }
              >
                <option value="">Все</option>
                {warehouseOptions.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Ячейка">
              <select
                value={filters.location_id}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, location_id: e.target.value }))
                }
              >
                <option value="">Все</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Товар">
              <select
                value={filters.item_id}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, item_id: e.target.value }))
                }
              >
                <option value="">Все</option>
                {itemOptions.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </FormField>
            <button type="submit" disabled={loading}>
              Обновить
            </button>
          </form>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Склад</th>
                  <th>Ячейка</th>
                  <th>Товар</th>
                  <th>Количество</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.id}</td>
                    <td>{inv.warehouse_id}</td>
                    <td>{inv.location_id}</td>
                    <td>{inv.item_id}</td>
                    <td>{inv.quantity}</td>
                  </tr>
                ))}
                {inventory.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      Остатков нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </Card>
    </div>
  );
}

function getLocationOptions(
  warehouseId: string,
  map: Map<number, Location[]>
): Location[] {
  const idNum = Number(warehouseId);
  if (!idNum) return [];
  return map.get(idNum) || [];
}

function buildInboundPayload(form: {
  warehouse_id: string;
  location_id: string;
  item_id: string;
  qty: string;
}): InboundPayload | null {
  const warehouse_id = Number(form.warehouse_id);
  const location_id = Number(form.location_id);
  const item_id = Number(form.item_id);
  const qty = Number(form.qty);
  if (!warehouse_id || !location_id || !item_id || !qty) return null;
  return { warehouse_id, location_id, item_id, qty };
}

function buildMovePayload(form: {
  warehouse_id: string;
  from_location_id: string;
  to_location_id: string;
  item_id: string;
  qty: string;
}): MovePayload | null {
  const warehouse_id = Number(form.warehouse_id);
  const from_location_id = Number(form.from_location_id);
  const to_location_id = Number(form.to_location_id);
  const item_id = Number(form.item_id);
  const qty = Number(form.qty);
  if (!warehouse_id || !from_location_id || !to_location_id || !item_id || !qty)
    return null;
  if (from_location_id === to_location_id) return null;
  return { warehouse_id, from_location_id, to_location_id, item_id, qty };
}
