import { FormEvent, useEffect, useState } from "react";
import { fetchWarehouses } from "../api/warehouses";
import { createZone, fetchZones } from "../api/zones";
import { Warehouse, Zone } from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wh, zs] = await Promise.all([fetchWarehouses(), fetchZones()]);
        setWarehouses(wh);
        setZones(zs);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить зоны");
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
      await createZone({ name: name.trim(), code: code.trim(), warehouse_id: wId });
      setMessage("Зона создана");
      setName("");
      setCode("");
      setWarehouseId("");
      const zs = await fetchZones();
      setZones(zs);
    } catch (err: any) {
      setError(err.message || "Ошибка создания зоны");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Card title="Зоны">
        <form className="form" onSubmit={handleSubmit}>
          <FormField label="Название">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Зона A"
            />
          </FormField>
          <FormField label="Код">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="A"
            />
          </FormField>
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
          <button type="submit" disabled={loading}>
            {loading ? "Сохраняю..." : "Создать зону"}
          </button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Код</th>
                <th>Склад</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td>{z.id}</td>
                  <td>{z.name}</td>
                  <td>{z.code}</td>
                  <td>{z.warehouse_id}</td>
                </tr>
              ))}
              {zones.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    Нет зон
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
