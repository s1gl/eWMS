import { FormEvent, useEffect, useState } from "react";
import { fetchWarehouses } from "../api/warehouses";
import { createZone, deleteZone, fetchZones, updateZone } from "../api/zones";
import { Warehouse } from "../types/warehouse";
import { Zone, ZoneType } from "../types/zone";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

const zoneLabels: Record<ZoneType, string> = {
  inbound: "Приёмка",
  storage: "Хранение",
  outbound: "Отгрузка",
};

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneType, setZoneType] = useState<ZoneType>("storage");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wh, zs] = await Promise.all([fetchWarehouses(), fetchZones()]);
        setWarehouses(wh);
        setZones(zs);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить зоны и склады");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const wId = Number(warehouseId);
    if (!name.trim() || !code.trim() || !wId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (editId) {
        await updateZone(editId, {
          name: name.trim(),
          code: code.trim(),
          warehouse_id: wId,
          zone_type: zoneType,
        });
        setMessage("Зона обновлена");
      } else {
        await createZone({
          name: name.trim(),
          code: code.trim(),
          warehouse_id: wId,
          zone_type: zoneType,
        });
        setMessage("Зона создана");
      }
      setName("");
      setCode("");
      setWarehouseId("");
      setZoneType("storage");
      setEditId(null);
      const zs = await fetchZones();
      setZones(zs);
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить зону");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (z: Zone) => {
    setEditId(z.id);
    setName(z.name);
    setCode(z.code);
    setWarehouseId(String(z.warehouse_id));
    setZoneType(z.zone_type);
    setMessage(null);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить зону?")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await deleteZone(id);
      setMessage("Зона удалена");
      const zs = await fetchZones();
      setZones(zs);
    } catch (e: any) {
      setError(e.message || "Не удалось удалить зону");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Card title="Зоны склада">
        <form className="form" onSubmit={handleSubmit}>
          <FormField label="Название зоны">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Например: Приёмка 1"
            />
          </FormField>
          <FormField label="Код зоны">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="IN-A"
            />
          </FormField>
          <FormField label="Тип зоны">
            <select
              value={zoneType}
              onChange={(e) => setZoneType(e.target.value as ZoneType)}
            >
              <option value="inbound">Приёмка</option>
              <option value="storage">Хранение</option>
              <option value="outbound">Отгрузка</option>
            </select>
          </FormField>
          <FormField label="Склад">
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
            >
              <option value="">Выберите склад</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </FormField>
          <div className="actions-row">
            <button type="submit" disabled={loading}>
              {loading ? "Сохранение..." : editId ? "Обновить" : "Создать"}
            </button>
            {editId && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setCode("");
                  setWarehouseId("");
                  setZoneType("storage");
                }}
              >
                Сбросить
              </button>
            )}
          </div>
        </form>

        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Код</th>
                <th>Тип</th>
                <th>Склад</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td>{z.id}</td>
                  <td>{z.name}</td>
                  <td>{z.code}</td>
                  <td>{zoneLabels[z.zone_type] || z.zone_type}</td>
                  <td>{z.warehouse_id}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleEdit(z)}
                      style={{ marginRight: 6 }}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleDelete(z.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {zones.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Зон нет
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
