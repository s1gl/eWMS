import { FormEvent, useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import { InboundOrder, InboundOrderLine, InboundStatus } from "../types/inbound";
import { changeInboundStatus, getInboundOrder, getInboundOrders, receiveInboundLine } from "../api/inbound";
import { fetchLocations } from "../api/locations";
import { fetchItems } from "../api/items";
import { Location } from "../types/location";
import { Item } from "../types";
import { useNavigate } from "react-router-dom";

type ReceiveForm = {
  line_id: string;
  item_id: string;
  condition: string;
  location_id: string;
  qty: string;
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
  };
  return map[status] || status;
};

export default function InventoryInboundPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [order, setOrder] = useState<InboundOrder | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<ReceiveForm>({
    line_id: "",
    item_id: "",
    condition: "good",
    location_id: "",
    qty: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<boolean>(false);

  useEffect(() => {
    loadOrders();
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
          const firstLine = ord.lines[0];
          setForm((prev) => ({
            ...prev,
            line_id: String(firstLine.id),
            item_id: String(firstLine.item_id),
            location_id: (firstLine.location_id ?? "").toString(),
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

  const loadOrders = async () => {
    setError(null);
    try {
      const [list, it] = await Promise.all([getInboundOrders(), fetchItems()]);
      setOrders(list);
      setItems(it);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить поставки");
    }
  };

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
    const qty = Number(form.qty);
    const locationId = Number(form.location_id);
    const lineId = Number(form.line_id);
    const itemId = Number(form.item_id);
    if (!lineId) {
      setError("Выберите строку поставки");
      return;
    }
    if (!locationId) {
      setError("Выберите ячейку склада");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Количество к приёмке должно быть больше нуля");
      return;
    }
    if (!itemId) {
      setError("Выберите товар для приёмки");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setProblem(false);
    try {
      const payload: any = {
        line_id: lineId,
        location_id: locationId,
        qty,
        item_id: itemId,
      };
      if (form.condition) payload.condition = form.condition;
      const updatedOrder = await receiveInboundLine(order.id, payload);
      setOrder(updatedOrder);
      setForm((prev) => ({ ...prev, qty: "" }));
      setMessage("Приёмка по товару выполнена");
      await completeIfReady(updatedOrder);
    } catch (e: any) {
      setProblem(true);
      if ((e.message || "").toLowerCase().includes("exceeds")) {
        setError("Количество к приёмке не может превышать ожидаемое по строке (статус: проблема)");
      } else {
        setError(e.message || "Не удалось принять строку (статус: проблема)");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (val: string) => {
    const id = Number(val);
    setSelectedId(Number.isFinite(id) ? id : null);
  };

  const toOrder = () => navigate("/inbound");

  const activeOrders = orders.filter(
    (o) => o.status === "in_progress" || o.status === "problem" || o.status === "mis_sort"
  );

  const currentLine: InboundOrderLine | undefined = order?.lines.find(
    (ln) => ln.id === Number(form.line_id)
  );
  const lineItemsOptions = order?.lines.map((ln) => ({
    value: ln.id,
    label: `Строка #${ln.id} — товар ID ${ln.item_id}`,
  })) ?? [];

  return (
    <div className="page">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {problem && (
        <Notice tone="warning">
          Есть проблема с приёмкой. Проверьте количество и повторите.
        </Notice>
      )}

      <Card title="Приёмка товаров">
        <p className="muted">
          Выберите поставку и принимайте товары только в её контексте. Начать приёмку можно
          в списке поставок. Здесь доступны только поставки со статусом «Выполняется».
        </p>
        <div className="form inline" style={{ gap: 12 }}>
          <FormField label="Поставка">
            <select
              value={selectedId ?? ""}
              onChange={(e) => handleSelectChange(e.target.value)}
            >
              <option value="">Выберите поставку</option>
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  № {o.id} — {o.external_number || "без номера"} ({statusLabels[o.status] || o.status})
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="ghost" onClick={toOrder}>
            Открыть список поставок
          </button>
        </div>
      </Card>

      {order && (
      <Card title="Данные поставки">
        <div className="grid two" style={{ marginBottom: 12 }}>
          <div>
            <p>
                <strong>Номер поставки:</strong>{" "}
                {order.external_number || `№${order.id}`}
              </p>
              <p>
                <strong>Склад:</strong> {order.warehouse_id}
              </p>
            </div>
            <div>
              <p>
                <strong>Статус:</strong>{" "}
                {problem ? "Проблема" : statusLabels[order.status] || order.status}
              </p>
              <p>
                <strong>Создана / обновлена:</strong>{" "}
                {order.created_at || "—"} / {order.updated_at || "—"}
              </p>
            </div>
          </div>
          <div className="actions-row" style={{ gap: 8 }}>
            {order.status === "in_progress" && (
              <Notice tone="info">Приёмка открыта. Примите товары по строкам ниже.</Notice>
            )}
            {order.status === "completed" && (
              <Notice tone="success">Поставка полностью принята.</Notice>
            )}
            {order.status === "draft" && (
              <Notice tone="warning">
                Запустите приёмку из списка поставок, чтобы обработать строки здесь.
              </Notice>
            )}
          </div>
        </Card>
      )}

      {order && (
        <Card title="Приёмка по строке">
          <form className="form" onSubmit={handleReceive}>
            <FormField label="Строка поставки">
              <select
                value={form.line_id}
                onChange={(e) => {
                  const lineId = e.target.value;
                  const ln = order.lines.find((l) => l.id === Number(lineId));
                  setForm((prev) => ({
                    ...prev,
                    line_id: lineId,
                    item_id: ln ? String(ln.item_id) : prev.item_id,
                    location_id: ln?.location_id ? String(ln.location_id) : prev.location_id,
                  }));
                }}
              >
                <option value="">Выберите строку</option>
                {lineItemsOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                  <th>Ожидаемое количество</th>
                  <th>Принятое количество</th>
                  <th>Статус строки</th>
                  <th>Ячейка</th>
                  {order.status === "in_progress" && <th>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => {
                  const item = items.find((i) => i.id === line.item_id);
                  const loc = locationsByWarehouse.get(order.warehouse_id)?.find(
                    (l) => l.id === line.location_id
                  );
                  const formState = forms[line.id] || { qty: "", location_id: "" };
                  return (
                    <tr key={line.id}>
                      <td>{item ? `${item.name} (${item.sku})` : `ID ${line.item_id}`}</td>
                      <td>{line.expected_qty}</td>
                      <td>{line.received_qty}</td>
                      <td>{lineStatusLabel(line.line_status)}</td>
                      <td>{loc ? loc.code : line.location_id ?? "—"}</td>
                      {order.status === "in_progress" && (
                        <td>
                          <form onSubmit={(e) => handleReceive(line, e)} className="form inline">
                            <FormField label="Ячейка хранения">
                              <select
                                value={formState.location_id}
                                onChange={(e) =>
                                  setForms((prev) => ({
                                    ...prev,
                                    [line.id]: { ...prev[line.id], location_id: e.target.value },
                                  }))
                                }
                              >
                                <option value="">
                                  Выберите ячейку, куда положите товар
                                </option>
                                {(locationsByWarehouse.get(order.warehouse_id) || []).map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.code}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField
                              label="Количество к приёмке"
                              helper="Не больше ожидаемого по строке"
                            >
                              <input
                                type="number"
                                min={1}
                                value={formState.qty}
                                onChange={(e) =>
                                  setForms((prev) => ({
                                    ...prev,
                                    [line.id]: { ...prev[line.id], qty: e.target.value },
                                  }))
                                }
                                placeholder="Введите количество"
                                style={{ width: 120 }}
                              />
                            </FormField>
                            <button type="submit" disabled={loading}>
                              {loading ? "Обработка..." : "Принять товар"}
                            </button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {!order.lines.length && (
                  <tr>
                    <td colSpan={order.status === "in_progress" ? 6 : 5} style={{ textAlign: "center" }}>
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
