import { FormEvent, useEffect, useState } from "react";
import {
  createWarehouse,
  deleteWarehouse,
  fetchWarehouses,
  updateWarehouse,
} from "../api/warehouses";
import { Warehouse } from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
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
      if (editId) {
        await updateWarehouse(editId, {
          name: name.trim(),
          code: code.trim(),
          is_active: isActive,
        });
        setMessage("Склад обновлён");
      } else {
        await createWarehouse({ name: name.trim(), code: code.trim() });
        setMessage("Склад создан");
      }
      setName("");
      setCode("");
      setIsActive(true);
      setEditId(null);
      await load();
    } catch (err: any) {
      setError(err.message || "Ошибка сохранения склада");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (wh: Warehouse) => {
    setEditId(wh.id);
    setName(wh.name);
    setCode(wh.code);
    setIsActive(wh.is_active);
    setMessage(null);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить склад?")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await deleteWarehouse(id);
      setMessage("Склад удалён (деактивирован)");
      await load();
    } catch (e: any) {
      setError(e.message || "Ошибка удаления");
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
          <FormField label="Активен">
            <select
              value={isActive ? "true" : "false"}
              onChange={(e) => setIsActive(e.target.value === "true")}
              disabled={!editId}
            >
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </select>
          </FormField>
          <div className="actions-row">
            <button type="submit" disabled={loading}>
              {loading ? "Сохраняю..." : editId ? "Сохранить" : "Создать склад"}
            </button>
            {editId && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setCode("");
                  setIsActive(true);
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
                <th>Название</th>
                <th>Код</th>
                <th>Активен</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id}>
                  <td>{w.id}</td>
                  <td>{w.name}</td>
                  <td>{w.code}</td>
                  <td>{w.is_active ? "Да" : "Нет"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleEdit(w)}
                      style={{ marginRight: 6 }}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleDelete(w.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {warehouses.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
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
