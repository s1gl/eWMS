import { FormEvent, useEffect, useMemo, useState } from "react";
import { createInbound } from "../api/inventory";
import { fetchWarehouses } from "../api/warehouses";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import {
  InboundPayload,
  Item,
  Location,
  Warehouse,
} from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

type Option = { value: number; label: string };

export default function InventoryInboundPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [form, setForm] = useState({
    warehouse_id: "",
    location_id: "",
    item_id: "",
    qty: "",
    unit: "pcs",
  });

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wh, it, loc] = await Promise.all([
          fetchWarehouses(),
          fetchItems(),
          fetchLocations(),
        ]);
        setWarehouses(wh);
        setItems(it);
        setLocations(loc);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const locationOptionsByWarehouse = useMemo(() => {
    const map = new Map<number, Location[]>();
    locations.forEach((loc) => {
      const arr = map.get(loc.warehouse_id) || [];
      arr.push(loc);
      map.set(loc.warehouse_id, arr);
    });
    return map;
  }, [locations]);

  const warehouseOptions: Option[] = warehouses.map((w) => ({
    value: w.id,
    label: `${w.name} (${w.code})`,
  }));
  const itemOptions: Option[] = items.map((i) => ({
    value: i.id,
    label: `${i.name} (${i.sku})`,
  }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = buildPayload(form);
    if (!payload) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await createInbound(payload);
      setMessage("Приёмка выполнена");
      setForm((p) => ({ ...p, qty: "" }));
    } catch (err: any) {
      setError(err.message || "Ошибка приёмки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Card title="Приёмка">
        <form className="form" onSubmit={handleSubmit}>
          <FormField label="Склад">
            <select
              value={form.warehouse_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, warehouse_id: e.target.value }))
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
              value={form.location_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, location_id: e.target.value }))
              }
              required
            >
              <option value="">Выберите ячейку</option>
              {getLocationOptions(form.warehouse_id, locationOptionsByWarehouse).map(
                (loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code}
                  </option>
                )
              )}
            </select>
          </FormField>
          <FormField label="Товар">
            <select
              value={form.item_id}
              onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}
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
              value={form.qty}
              onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Ед. изм.">
            <select
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
            >
              <option value="pcs">pcs</option>
              <option value="kg">kg</option>
              <option value="l">l</option>
              <option value="box">box</option>
            </select>
          </FormField>
          <button type="submit" disabled={loading}>
            {loading ? "Выполняю..." : "Приход"}
          </button>
        </form>
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

function buildPayload(form: {
  warehouse_id: string;
  location_id: string;
  item_id: string;
  qty: string;
  unit: string;
}): InboundPayload | null {
  const warehouse_id = Number(form.warehouse_id);
  const location_id = Number(form.location_id);
  const item_id = Number(form.item_id);
  const qty = Number(form.qty);
  if (!warehouse_id || !location_id || !item_id || !qty) return null;
  return { warehouse_id, location_id, item_id, qty, unit: form.unit || "pcs" };
}
