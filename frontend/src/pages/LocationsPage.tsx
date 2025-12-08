import { FormEvent, useEffect, useState } from "react";
import { fetchWarehouses } from "../api/warehouses";
import { createLocation, fetchLocations } from "../api/locations";
import { fetchZones } from "../api/zones";
import { Location, Warehouse, Zone } from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wh, zs, locs] = await Promise.all([
          fetchWarehouses(),
          fetchZones(),
          fetchLocations(),
        ]);
        setWarehouses(wh);
        setZones(zs);
        setLocations(locs);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить ячейки");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const wId = Number(warehouseId);
    const zId = zoneId ? Number(zoneId) : undefined;
    if (!wId || !code.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await createLocation({
        warehouse_id: wId,
        zone_id: zId,
        code: code.trim(),
        description: description.trim() || undefined,
      });
      setMessage("Ячейка создана");
      setCode("");
      setZoneId("");
      setDescription("");
      const locs = await fetchLocations();
      setLocations(locs);
    } catch (err: any) {
      setError(err.message || "Ошибка создания ячейки");
    } finally {
      setLoading(false);
    }
  };

  const filteredZones = warehouseId
    ? zones.filter((z) => z.warehouse_id === Number(warehouseId))
    : zones;

  return (
    <div className="page">
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Card title="Ячейки">
        <form className="form" onSubmit={handleSubmit}>
          <FormField label="Склад">
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
            >
              <option value="">Выберите</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Зона (опционально)">
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">Без зоны</option>
              {filteredZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.code})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Код ячейки">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="LOC-01"
            />
          </FormField>
          <FormField label="Описание">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опционально"
            />
          </FormField>
          <button type="submit" disabled={loading}>
            {loading ? "Сохраняю..." : "Создать ячейку"}
          </button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Склад</th>
                <th>Зона</th>
                <th>Код</th>
                <th>Описание</th>
                <th>Активна</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td>{loc.id}</td>
                  <td>{loc.warehouse_id}</td>
                  <td>{loc.zone_id ?? "—"}</td>
                  <td>{loc.code}</td>
                  <td>{loc.description || "—"}</td>
                  <td>{loc.is_active ? "Да" : "Нет"}</td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Нет ячеек
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
