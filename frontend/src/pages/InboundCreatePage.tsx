import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createInboundOrder } from "../api/inbound";
import { fetchWarehouses } from "../api/warehouses";
import { fetchItems } from "../api/items";
import { Warehouse } from "../types/warehouse";
import { Item } from "../types";
import { InboundOrderCreate } from "../types/inbound";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";

type LineForm = { item_id: string; expected_qty: string; location_id?: string };

export default function InboundCreatePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [externalNumber, setExternalNumber] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ item_id: "", expected_qty: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [wh, it] = await Promise.all([fetchWarehouses(), fetchItems()]);
        setWarehouses(wh);
        setItems(it);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить справочники");
      }
    };
    load();
  }, []);

  const handleAddLine = () => {
    setLines((prev) => [...prev, { item_id: "", expected_qty: "" }]);
  };

  const handleLineChange = (idx: number, field: keyof LineForm, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      setError("Выберите склад для приёмки");
      return;
    }
    const preparedLines = lines
      .filter((l) => l.item_id && l.expected_qty)
      .map((l) => ({
        item_id: Number(l.item_id),
        expected_qty: Number(l.expected_qty),
      }));
    if (preparedLines.length === 0) {
      setError("Добавьте хотя бы один товар");
      return;
    }
    if (preparedLines.some((l) => l.expected_qty <= 0)) {
      setError("Количество должно быть больше нуля");
      return;
    }
    const payload: InboundOrderCreate = {
      external_number: externalNumber.trim(),
      warehouse_id: Number(warehouseId),
      lines: preparedLines,
    };
    setLoading(true);
    setError(null);
    try {
      const created = await createInboundOrder(payload);
      navigate(`/inbound/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Не удалось создать поставку");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Card title="Новая поставка">
        <p className="muted">
          Выберите склад, при необходимости укажите номер поставки от клиента и добавьте
          товары, которые планируются к приёмке.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <form className="form" onSubmit={handleSubmit}>
          <FormField label="Склад">
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
            >
              <option value="">Выберите склад для приёмки</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Номер поставки (от клиента или поставщика)">
            <input
              value={externalNumber}
              onChange={(e) => setExternalNumber(e.target.value)}
              placeholder="Например: PO-2025-00123 (необязательно)"
            />
          </FormField>
        </form>

        <Card
          title="Товары в поставке"
          actions={
            <button type="button" className="ghost" onClick={handleAddLine}>
              Добавить товар в поставку
            </button>
          }
        >
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Ожидаемое количество</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        value={l.item_id}
                        onChange={(e) => handleLineChange(idx, "item_id", e.target.value)}
                      >
                        <option value="">Выберите товар</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.sku})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={l.expected_qty}
                        onChange={(e) =>
                          handleLineChange(idx, "expected_qty", e.target.value)
                        }
                        placeholder="Введите количество"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Создание..." : "Создать поставку"}
        </button>
      </Card>
    </div>
  );
}
