import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { changeInboundStatus, getInboundOrder, receiveInboundLine } from "../api/inbound";
import { fetchWarehouses } from "../api/warehouses";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import { InboundOrder, InboundOrderLine, InboundStatus } from "../types/inbound";
import { Warehouse } from "../types/warehouse";
import { Item } from "../types";
import { Location } from "../types/location";
import Card from "../components/Card";
import Notice from "../components/Notice";
import FormField from "../components/FormField";

type LineForm = { qty: string; location_id: string };

const statusLabels: Record<InboundStatus, string> = {
  draft: "Черновик",
  in_progress: "В процессе",
  completed: "Завершена",
  cancelled: "Отменена",
};

export default function InboundDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);

  const [order, setOrder] = useState<InboundOrder | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [forms, setForms] = useState<Record<number, LineForm>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const warehouseName = useMemo(() => {
    if (!order) return "";
    const wh = warehouses.find((w) => w.id === order.warehouse_id);
    return wh ? `${wh.name} (${wh.code})` : `ID ${order.warehouse_id}`;
  }, [order, warehouses]);

  useEffect(() => {
    if (!orderId) {
      setError("Некорректный идентификатор поставки");
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const ord = await getInboundOrder(orderId);
        const [wh, it, loc] = await Promise.all([
          fetchWarehouses(),
          fetchItems(),
          fetchLocations({ warehouse_id: ord.warehouse_id }),
        ]);
        setOrder(ord);
        setWarehouses(wh);
        setItems(it);
        setLocations(loc);
        setForms(
          ord.lines.reduce<Record<number, LineForm>>((acc, line) => {
            acc[line.id] = {
              qty: "",
              location_id: (line.location_id ?? "").toString(),
            };
            return acc;
          }, {})
        );
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить поставку");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  const handleStatusChange = async (status: InboundStatus) => {
    if (!order) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await changeInboundStatus(order.id, { status });
      setMessage("Статус обновлён");
      const updated = await getInboundOrder(order.id);
      setOrder(updated);
    } catch (e: any) {
      setError(e.message || "Не удалось обновить статус");
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (
    line: InboundOrderLine,
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!order) return;
    const form = forms[line.id] || { qty: "", location_id: "" };
    const qty = Number(form.qty);
    const locationId = Number(form.location_id);
    if (!qty || qty <= 0 || !locationId) {
      setError("Укажите количество и ячейку");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await receiveInboundLine(order.id, {
        line_id: line.id,
        location_id: locationId,
        qty,
      });
      setOrder(updated);
      setMessage("Приёмка строки выполнена");
      setForms((prev) => ({
        ...prev,
        [line.id]: { qty: "", location_id: form.location_id },
      }));
    } catch (e: any) {
      setError(e.message || "Не удалось принять строку");
    } finally {
      setLoading(false);
    }
  };

  if (!orderId) {
    return (
      <div className="page">
        <Notice tone="error">Некорректный ID поставки</Notice>
      </div>
    );
  }

  return (
    <div className="page">
      <Card
        title={`Поставка #${order?.id ?? orderId}`}
        actions={
          <Link className="ghost" to="/inbound">
            ← К списку поставок
          </Link>
        }
      >
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        {loading && <Notice tone="info">Загрузка...</Notice>}

        {order && (
          <>
            <div className="grid two">
              <div>
                <p>
                  <strong>Склад:</strong> {warehouseName}
                </p>
                <p>
                  <strong>Номер поставки:</strong> {order.external_number}
                </p>
                <p>
                  <strong>Статус:</strong> {statusLabels[order.status] || order.status}
                </p>
              </div>
              <div>
                <p>
                  <strong>Создана:</strong> {order.created_at ?? "—"}
                </p>
                <p>
                  <strong>Обновлена:</strong> {order.updated_at ?? "—"}
                </p>
              </div>
            </div>

            <div className="actions-row" style={{ marginTop: 12 }}>
              {order.status === "draft" && (
                <button onClick={() => handleStatusChange("in_progress")} disabled={loading}>
                  Начать приёмку
                </button>
              )}
              {order.status === "in_progress" && (
                <>
                  <button onClick={() => handleStatusChange("completed")} disabled={loading}>
                    Завершить
                  </button>
                  <button
                    onClick={() => handleStatusChange("cancelled")}
                    disabled={loading}
                    className="ghost"
                  >
                    Отменить
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Card>

      <Card title="Строки поставки">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Ожид.</th>
                <th>Принято</th>
                <th>Статус</th>
                <th>Ячейка</th>
                {order?.status === "in_progress" && <th>Приёмка</th>}
              </tr>
            </thead>
            <tbody>
              {order?.lines.map((line) => {
                const item = items.find((i) => i.id === line.item_id);
                const location = locations.find((l) => l.id === line.location_id);
                return (
                  <tr key={line.id}>
                    <td>
                      {item ? (
                        <>
                          {item.name} ({item.sku})
                        </>
                      ) : (
                        `ID ${line.item_id}`
                      )}
                    </td>
                    <td>{line.expected_qty}</td>
                    <td>{line.received_qty}</td>
                    <td>{line.line_status || "—"}</td>
                    <td>{location ? location.code : line.location_id ?? "—"}</td>
                    {order?.status === "in_progress" && (
                      <td>
                        <form onSubmit={(e) => handleReceive(line, e)} className="form inline">
                          <FormField label="Ячейка">
                            <select
                              value={forms[line.id]?.location_id ?? ""}
                              onChange={(e) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], location_id: e.target.value },
                                }))
                              }
                            >
                              <option value="">Выбрать</option>
                              {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.code}
                                </option>
                              ))}
                            </select>
                          </FormField>
                          <FormField label="Кол-во">
                            <input
                              type="number"
                              min={1}
                              value={forms[line.id]?.qty ?? ""}
                              onChange={(e) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], qty: e.target.value },
                                }))
                              }
                              style={{ width: 90 }}
                            />
                          </FormField>
                          <button type="submit" disabled={loading}>
                            Принять
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!order?.lines.length && (
                <tr>
                  <td colSpan={order?.status === "in_progress" ? 6 : 5} style={{ textAlign: "center" }}>
                    Нет строк
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
