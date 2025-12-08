import { FormEvent, useEffect, useState } from "react";
import { fetchWarehouses } from "../api/warehouses";
import { createLocation, fetchLocations, deleteLocation, updateLocation } from "../api/locations";
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
  const [editId, setEditId] = useState<number | null>(null);
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
      if (editId) {
        await updateLocation(editId, {
          warehouse_id: wId,
          zone_id: zId ?? null,
          code: code.trim(),
          description: description.trim() || undefined,
        });
        setMessage("Ячейка обновлена");
      } else {
        await createLocation({
          warehouse_id: wId,
          zone_id: zId,
          code: code.trim(),
          description: description.trim() || undefined,
        });
        setMessage("Ячейка создана");
      }
      setCode("");
      setZoneId("");
      setDescription("");
      setEditId(null);
      const locs = await fetchLocations();
      setLocations(locs);
    } catch (err: any) {
      setError(err.message || "Ошибка сохранения ячейки");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (loc: Location) => {
    setEditId(loc.id);
    setWarehouseId(String(loc.warehouse_id));
    setZoneId(loc.zone_id ? String(loc.zone_id) : "");
    setCode(loc.code);
    setDescription(loc.description || "");
    setMessage(null);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить (деактивировать) ячейку?")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await deleteLocation(id);
      setMessage("Ячейка удалена (деактивирована)");
      const locs = await fetchLocations();
      setLocations(locs);
    } catch (e: any) {
      setError(e.message || "Ошибка удаления");
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
          <div className="actions-row">
            <button type="submit" disabled={loading}>
              {loading ? "Сохраняю..." : editId ? "Сохранить" : "Создать ячейку"}
            </button>
            {editId && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditId(null);
                  setWarehouseId("");
                  setZoneId("");
                  setCode("");
                  setDescription("");
                }}
              >
                Отмена
              </button>
            )}
          </div>
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
                <th />
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
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleEdit(loc)}
                      style={{ marginRight: 6 }}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleDelete(loc.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
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
