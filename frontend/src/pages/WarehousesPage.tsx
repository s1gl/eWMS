import { FormEvent, useEffect, useState } from "react";
import { createWarehouse, fetchWarehouses } from "../api/warehouses";
import { Warehouse } from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWarehouses();
      setWarehouses(data);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить склады");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await createWarehouse({ name: name.trim(), code: code.trim() });
      setMessage("Склад создан");
      setName("");
      setCode("");
      await load();
    } catch (err: any) {
      setError(err.message || "Ошибка создания склада");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Card title="Склады">
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <form className="form" onSubmit={handleSubmit}>
          <FormField label="Название">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Основной склад"
              required
            />
          </FormField>
          <FormField label="Код">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="WH01"
              required
            />
          </FormField>
          <button type="submit" disabled={loading}>
            {loading ? "Сохраняю..." : "Создать склад"}
          </button>
        </form>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Код</th>
                <th>Активен</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id}>
                  <td>{w.id}</td>
                  <td>{w.name}</td>
                  <td>{w.code}</td>
                  <td>{w.is_active ? "Да" : "Нет"}</td>
                </tr>
              ))}
              {warehouses.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    Нет складов
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
