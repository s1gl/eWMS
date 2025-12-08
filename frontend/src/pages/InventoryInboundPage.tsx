import { FormEvent, useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import { InboundOrder, InboundOrderLine, InboundStatus } from "../types/inbound";
import { getInboundOrder, getInboundOrders, receiveInboundLine, changeInboundStatus } from "../api/inbound";
import { fetchLocations } from "../api/locations";
import { fetchItems } from "../api/items";
import { Location } from "../types/location";
import { Item } from "../types";
import { useNavigate } from "react-router-dom";

type LineForm = { qty: string; location_id: string };

const statusLabels: Record<InboundStatus, string> = {
  draft: "Черновик",
  in_progress: "Выполняется",
  completed: "Принято",
  cancelled: "Отменена",
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
  const [forms, setForms] = useState<Record<number, LineForm>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<boolean>(false);

  useEffect(() => {
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
        setForms(
          ord.lines.reduce<Record<number, LineForm>>((acc, line) => {
            acc[line.id] = { qty: "", location_id: (line.location_id ?? "").toString() };
            return acc;
          }, {})
        );
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить поставку");
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

  const startReceiving = async () => {
    if (!order) return;
    if (order.status === "in_progress") return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await changeInboundStatus(order.id, { status: "in_progress" });
      const updated = await getInboundOrder(order.id);
      setOrder(updated);
      setMessage("Приёмка начата");
    } catch (e: any) {
      setError(e.message || "Не удалось начать приёмку");
    } finally {
      setLoading(false);
    }
  };

  const completeIfReady = async (updated: InboundOrder) => {
    const allReceived = updated.lines.every(
      (ln) => ln.received_qty >= ln.expected_qty && ln.expected_qty > 0
    );
    if (allReceived && updated.status === "in_progress") {
      try {
        await changeInboundStatus(updated.id, { status: "completed" });
        const refreshed = await getInboundOrder(updated.id);
        setOrder(refreshed);
        setMessage("Все товары приняты, поставка закрыта");
      } catch (e: any) {
        // оставим статус как есть, покажем предупреждение
        setError(e.message || "Не удалось закрыть поставку");
      }
    }
  };

  const handleReceive = async (line: InboundOrderLine, e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!order) return;
    const form = forms[line.id] || { qty: "", location_id: "" };
    const qty = Number(form.qty);
    const locationId = Number(form.location_id);
    if (!locationId) {
      setError("Выберите ячейку склада");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Количество к приёмке должно быть больше нуля");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setProblem(false);
    try {
      const updatedOrder = await receiveInboundLine(order.id, {
        line_id: line.id,
        location_id: locationId,
        qty,
      });
      setOrder(updatedOrder);
      setForms((prev) => ({
        ...prev,
        [line.id]: { qty: "", location_id: form.location_id },
      }));
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

  return (
    <div className="page">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {problem && <Notice tone="warning">Есть проблема с приёмкой. Проверьте количество и повторите.</Notice>}

      <Card title="Приёмка товаров">
        <p className="muted">
          Выберите поставку и принимайте товары только в её контексте. После старта поставка
          получает статус «Выполняется», после полного приёма — «Принято».
        </p>
        <div className="form inline" style={{ gap: 12 }}>
          <FormField label="Поставка">
            <select
              value={selectedId ?? ""}
              onChange={(e) => handleSelectChange(e.target.value)}
            >
              <option value="">Выберите поставку</option>
              {orders.map((o) => (
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
            {order.status === "draft" && (
              <button onClick={startReceiving} disabled={loading}>
                {loading ? "Запуск..." : "Начать приёмку"}
              </button>
            )}
            {order.status === "in_progress" && (
              <Notice tone="info">Приёмка открыта. Примите товары по строкам ниже.</Notice>
            )}
            {order.status === "completed" && (
              <Notice tone="success">Поставка полностью принята.</Notice>
            )}
          </div>
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
                      <td>
                        {item ? `${item.name} (${item.sku})` : `ID ${line.item_id}`}
                      </td>
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
                                {(locationsByWarehouse.get(order.warehouse_id) || []).map(
                                  (l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.code}
                                    </option>
                                  )
                                )}
                              </select>
                            </FormField>
                            <FormField label="Количество к приёмке" helper="Не больше ожидаемого по строке">
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
