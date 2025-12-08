import { FormEvent, useEffect, useState } from "react";
import { createItem, fetchItems } from "../api/items";
import { Item } from "../types";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

const UNITS = ["pcs", "kg", "l", "box"];

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchItems();
      setItems(data);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить товары");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await createItem({
        sku: sku.trim(),
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        unit: unit || "pcs",
      });
      setMessage("Товар создан");
      setSku("");
      setName("");
      setBarcode("");
      setUnit("pcs");
      await load();
    } catch (err: any) {
      setError(err.message || "Ошибка создания товара");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Card title="Товары">
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <form className="form" onSubmit={handleSubmit}>
          <FormField label="SKU">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU001"
              required
            />
          </FormField>
          <FormField label="Название">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Товар"
              required
            />
          </FormField>
          <FormField label="Штрихкод">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="0123456789"
            />
          </FormField>
          <FormField label="Ед. изм.">
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </FormField>
          <button type="submit" disabled={loading}>
            {loading ? "Сохраняю..." : "Создать товар"}
          </button>
        </form>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SKU</th>
                <th>Название</th>
                <th>Штрихкод</th>
                <th>Ед. изм.</th>
                <th>Активен</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{it.sku}</td>
                  <td>{it.name}</td>
                  <td>{it.barcode || "—"}</td>
                  <td>{it.unit}</td>
                  <td>{it.is_active ? "Да" : "Нет"}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Нет товаров
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
