import { FormEvent, useEffect, useState } from "react";
import { fetchInventory } from "../api/inventory";
import { fetchWarehouses } from "../api/warehouses";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import { fetchZones } from "../api/zones";
import { InventoryRecord, Item, Location, Warehouse, Zone } from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

export default function InventoryStockPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);

  const [filters, setFilters] = useState({
    warehouse_id: "",
    location_id: "",
    item_id: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wh, it, loc, inv, zs] = await Promise.all([
          fetchWarehouses(),
          fetchItems(),
          fetchLocations(),
          fetchInventory(),
          fetchZones(),
        ]);
        setWarehouses(wh);
        setItems(it);
        setLocations(loc);
        setInventory(inv);
        setZones(zs);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleFilter = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInventory({
        warehouse_id: toNum(filters.warehouse_id),
        location_id: toNum(filters.location_id),
        item_id: toNum(filters.item_id),
      });
      setInventory(data);
    } catch (err: any) {
      setError(err.message || "Не удалось обновить остатки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {error && <Notice tone="error">{error}</Notice>}
      <Card title="Остатки" actions={<span className="muted">Фильтры</span>}>
        <form className="form inline" onSubmit={handleFilter}>
          <FormField label="Склад">
            <select
              value={filters.warehouse_id}
              onChange={(e) =>
                setFilters((p) => ({ ...p, warehouse_id: e.target.value }))
              }
            >
              <option value="">Все</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
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
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.sku})
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
                <th>Зона</th>
                <th>Ячейка</th>
                <th>SKU</th>
                <th>Товар</th>
                <th>Ед. изм.</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((inv) => {
                const item = getItemInfo(inv.item_id, items);
                return (
                  <tr key={inv.id}>
                    <td>{inv.id}</td>
                    <td>{getWarehouseCode(inv.warehouse_id, warehouses)}</td>
                    <td>{getZoneCode(inv.location_id, locations, zones)}</td>
                    <td>{getLocationCode(inv.location_id, locations)}</td>
                    <td>{item?.sku ?? "—"}</td>
                    <td>{item?.name ?? "—"}</td>
                    <td>{item?.unit ?? "—"}</td>
                    <td>{inv.quantity}</td>
                  </tr>
                );
              })}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    Остатков нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function toNum(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function getLocationCode(id: number, list: Location[]) {
  const found = list.find((l) => l.id === id);
  return found ? found.code : id;
}

function getWarehouseCode(id: number, list: Warehouse[]) {
  const found = list.find((w) => w.id === id);
  return found ? found.code : id;
}

function getZoneCode(locationId: number, locs: Location[], zones: Zone[]) {
  const loc = locs.find((l) => l.id === locationId);
  if (!loc || !loc.zone_id) return "—";
  const z = zones.find((zone) => zone.id === loc.zone_id);
  return z ? z.code : loc.zone_id;
}

function getItemInfo(id: number, list: Item[]) {
  return list.find((i) => i.id === id);
}
