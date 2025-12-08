import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import { getInboundOrders, getInboundOrder, receiveInboundLine, changeInboundStatus } from "../api/inbound";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import { InboundOrder, InboundOrderLine, InboundStatus } from "../types/inbound";
import { Item } from "../types";
import { Location } from "../types/location";

type ReceiveForm = {
  line_id: string;
  item_id: string;
  condition: string;
  qty: string;
  location_id: string;
};

const statusLabels: Record<InboundStatus, string> = {
  draft: "Черновик",
  in_progress: "Выполняется",
  completed: "Принято",
  cancelled: "Отменена",
  problem: "Проблема",
  mis_sort: "Пересорт",
};

const lineStatusLabel = (status?: string | null) => {
  if (!status) return "—";
  const map: Record<string, string> = {
    open: "Открыта",
    partially_received: "Частично принято",
    fully_received: "Принято полностью",
    cancelled: "Отменена",
    over_received: "Принято больше, чем заявлено",
    mis_sort: "Пересорт",
    good: "Годен",
    defect: "Брак",
    quarantine: "Карантин",
  };
  return map[status] || status;
};

export default function InventoryInboundPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [order, setOrder] = useState<InboundOrder | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState<ReceiveForm>({
    line_id: "",
    item_id: "",
    condition: "good",
    qty: "",
    location_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [list, it] = await Promise.all([getInboundOrders(), fetchItems()]);
        setOrders(list);
        setItems(it);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить поставки");
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadOrder = async () => {
      if (!selectedId) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      setProblem(false);
      try {
        const ord = await getInboundOrder(selectedId);
        setOrder(ord);
        const locs = await fetchLocations({ warehouse_id: ord.warehouse_id });
        setLocations(locs);
        if (ord.lines.length) {
          const ln = ord.lines[0];
          setForm((prev) => ({
            ...prev,
            line_id: String(ln.id),
            item_id: String(ln.item_id),
            location_id: ln.location_id ? String(ln.location_id) : "",
          }));
        }
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить выбранную поставку");
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [selectedId]);

  const locationsByWarehouse = useMemo(() => {
    const map = new Map<number, Location[]>();
    locations.forEach((loc) => {
      const arr = map.get(loc.warehouse_id) || [];
      arr.push(loc);
      map.set(loc.warehouse_id, arr);
    });
    return map;
  }, [locations]);

  const completeIfReady = async (updated: InboundOrder) => {
    const allReceived = updated.lines.every(
      (ln) => ln.expected_qty > 0 && ln.received_qty >= ln.expected_qty
    );
    if (allReceived && updated.status === "in_progress") {
      try {
        await changeInboundStatus(updated.id, { status: "completed" });
        const refreshed = await getInboundOrder(updated.id);
        setOrder(refreshed);
        setMessage("Все товары приняты, поставка закрыта");
      } catch (e: any) {
        setError(e.message || "Не удалось закрыть поставку");
      }
    }
  };

  const handleReceive = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!order) return;
    const lineId = Number(form.line_id);
    const itemId = Number(form.item_id);
    const qty = Number(form.qty);
    const locationId = Number(form.location_id);
    if (!lineId) return setError("Выберите строку поставки");
    if (!itemId) return setError("Выберите товар для приёмки");
    if (!locationId) return setError("Выберите ячейку склада");
    if (!qty || qty <= 0) return setError("Количество должно быть больше нуля");

    setLoading(true);
    setError(null);
    setMessage(null);
    setProblem(false);
    try {
      const payload: any = {
        line_id: lineId,
        item_id: itemId,
        qty,
        location_id: locationId,
      };
      if (form.condition) payload.condition = form.condition;
      const updated = await receiveInboundLine(order.id, payload);
      setOrder(updated);
      setMessage("Приёмка по товару выполнена");
      setForm((prev) => ({ ...prev, qty: "" }));
      await completeIfReady(updated);
    } catch (e: any) {
      setProblem(true);
      setError(
        e.message ||
          "Не удалось принять строку. Возможно, количество больше ожидаемого или пересорт."
      );
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = orders.filter((o) =>
    ["in_progress", "problem", "mis_sort"].includes(o.status)
  );

  const lineOptions =
    order?.lines.map((ln) => ({
      value: ln.id,
      label: `Строка #${ln.id} — товар ID ${ln.item_id}`,
    })) ?? [];

  return (
    <div className="page">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {problem && (
        <Notice tone="warning">
          Есть проблема или пересорт: проверьте количество/товар и статус поставки.
        </Notice>
      )}

      <Card title="Приёмка товаров">
        <p className="muted">
          Выберите поставку (в статусах «Выполняется», «Проблема», «Пересорт») и оформите
          приёмку. После полного приёма поставка закроется автоматически.
        </p>
        <div className="form inline" style={{ gap: 12 }}>
          <FormField label="Поставка">
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value) || null)}
            >
              <option value="">Выберите поставку</option>
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  №{o.id} — {o.external_number || "без номера"} ({statusLabels[o.status]})
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="ghost" onClick={() => navigate("/inbound")}>
            Открыть список поставок
          </button>
        </div>
      </Card>

      {order && (
        <Card title="Данные поставки">
          <div className="grid two" style={{ marginBottom: 12 }}>
            <div>
              <p>
                <strong>Номер поставки:</strong> {order.external_number || `№${order.id}`}
              </p>
              <p>
                <strong>Склад:</strong> {order.warehouse_id}
              </p>
            </div>
            <div>
              <p>
                <strong>Статус:</strong> {statusLabels[order.status] || order.status}
              </p>
              <p>
                <strong>Создана / обновлена:</strong> {order.created_at || "—"} /{" "}
                {order.updated_at || "—"}
              </p>
            </div>
          </div>
          {order.status === "in_progress" && (
            <Notice tone="info">Приёмка открыта. Примите товары по строкам.</Notice>
          )}
          {order.status === "completed" && (
            <Notice tone="success">Поставка полностью принята.</Notice>
          )}
        </Card>
      )}

      {order && (
        <Card title="Приёмка по строке">
          <form className="form" onSubmit={handleReceive}>
          <FormField label="Строка поставки">
            <input value={form.line_id} readOnly />
          </FormField>

            <FormField label="Товар">
              <select
                value={form.item_id}
                onChange={(e) => setForm((prev) => ({ ...prev, item_id: e.target.value }))}
              >
                <option value="">Выберите товар</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.sku})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Состояние">
              <select
                value={form.condition}
                onChange={(e) => setForm((prev) => ({ ...prev, condition: e.target.value }))}
              >
                <option value="good">Годен</option>
                <option value="defect">Брак</option>
                <option value="quarantine">Карантин</option>
              </select>
            </FormField>

            <FormField label="Количество">
              <input
                type="number"
                min={1}
                value={form.qty}
                onChange={(e) => setForm((prev) => ({ ...prev, qty: e.target.value }))}
                placeholder="Введите количество"
              />
            </FormField>

            <FormField label="Ячейка хранения">
              <select
                value={form.location_id}
                onChange={(e) => setForm((prev) => ({ ...prev, location_id: e.target.value }))}
              >
                <option value="">Выберите ячейку, куда положите товар</option>
                {(locationsByWarehouse.get(order.warehouse_id) || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="actions-row">
              <button type="submit" disabled={loading || !form.line_id || !form.location_id}>
                {loading ? "Обработка..." : "Принять"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {order && (
        <Card title="Строки поставки">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Заявлено</th>
                  <th>Принято</th>
                  <th>Статус строки</th>
                  <th>Ячейка</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => {
                  const item = items.find((i) => i.id === line.item_id);
                  const loc = locationsByWarehouse.get(order.warehouse_id)?.find(
                    (l) => l.id === line.location_id
                  );
                  return (
                    <tr key={line.id}>
                      <td>{item ? `${item.name} (${item.sku})` : `ID ${line.item_id}`}</td>
                      <td>{line.expected_qty}</td>
                      <td>{line.received_qty}</td>
                      <td>{lineStatusLabel(line.line_status)}</td>
                      <td>{loc ? loc.code : line.location_id ?? "—"}</td>
                    </tr>
                  );
                })}
                {!order.lines.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      В поставке нет строк
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
