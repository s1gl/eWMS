import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { changeInboundStatus, getInboundOrder } from "../api/inbound";
import { fetchWarehouses } from "../api/warehouses";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import { fetchZones } from "../api/zones";
import type { InboundOrder, InboundStatus } from "../types/inbound";
import type { Warehouse } from "../types/warehouse";
import type { Item } from "../types";
import type { Location } from "../types/location";
import type { Zone } from "../types/zone";
import Card from "../components/Card";
import Notice from "../components/Notice";

const statusLabels: Record<InboundStatus, string> = {
  created: "Создана",
  ready_for_receiving: "Готова к приёмке",
  receiving: "В приёмке",
  received: "Принята",
  cancelled: "Отменена",
  problem: "Проблема",
  mis_sort: "Пересорт",
  // поддержка старых статусов, если приходят из БД
  draft: "Готова к приёмке",
  in_progress: "В приёмке",
  completed: "Принята",
};

const lineStatusLabel = (status?: string | null) => {
  if (!status) return "—";
  const map: Record<string, string> = {
    open: "Открыта",
    partially_received: "Частично принято",
    fully_received: "Принято",
    cancelled: "Отменена",
    over_received: "Принято больше заявленного",
    mis_sort: "Пересорт",
  };
  return map[status] || status;
};

const lineColor = (line: InboundOrder["lines"][number]) => {
  if (line.expected_qty === 0 || line.line_status === "mis_sort") return "#ffe5e5";
  if (line.received_qty > line.expected_qty) return "#fff5cc";
  if (line.expected_qty > 0 && line.received_qty === line.expected_qty) return "#e8f9e8";
  return "transparent";
};

export default function InboundDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);

  const [order, setOrder] = useState<InboundOrder | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Неверный идентификатор поставки");
      return;
    }
    loadData();
  }, [orderId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const ord = await getInboundOrder(orderId);
      const [wh, it, loc, zn] = await Promise.all([
        fetchWarehouses(),
        fetchItems(),
        fetchLocations({ warehouse_id: ord.warehouse_id }),
        fetchZones({ warehouse_id: ord.warehouse_id }),
      ]);
      setOrder(ord);
      setWarehouses(wh);
      setItems(it);
      setLocations(loc);
      setZones(zn);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить данные поставки");
    } finally {
      setLoading(false);
    }
  };

  const warehouseName = useMemo(() => {
    if (!order) return "";
    const wh = warehouses.find((w) => w.id === order.warehouse_id);
    return wh ? `${wh.name} (${wh.code})` : `ID ${order.warehouse_id}`;
  }, [order, warehouses]);

  const zoneById = useMemo(() => {
    const map: Record<number, Zone> = {};
    zones.forEach((z) => (map[z.id] = z));
    return map;
  }, [zones]);

  const handleStatusChange = async (status: InboundStatus) => {
    if (!order) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await changeInboundStatus(order.id, { status });
      const updated = await getInboundOrder(order.id);
      setOrder(updated);
      setMessage("Статус поставки обновлён");
    } catch (e: any) {
      setError(e.message || "Не удалось обновить статус");
    } finally {
      setLoading(false);
    }
  };

  if (!orderId) {
    return (
      <div className="page">
        <Notice tone="error">Неверный ID поставки</Notice>
      </div>
    );
  }

  const titleNumber =
    order?.external_number?.trim() && order?.external_number.trim() !== ""
      ? order.external_number
      : `№${order?.id ?? orderId}`;

  return (
    <div className="page">
      <Card
        title={`Поставка ${titleNumber}`}
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
            <div className="grid two" style={{ marginBottom: 12 }}>
              <div>
                <p>
                  <strong>Склад:</strong> {warehouseName}
                </p>
                <p>
                  <strong>Внешний номер:</strong> {order.external_number || "—"}
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

            <div className="actions-row" style={{ marginTop: 12, gap: 8 }}>
              {order.status === "created" && (
                <button onClick={() => handleStatusChange("ready_for_receiving")} disabled={loading}>
                  Отправить в приёмку
                </button>
              )}
              {["draft", "ready_for_receiving"].includes(order.status) && (
                <button onClick={() => handleStatusChange("receiving")} disabled={loading}>
                  Начать приёмку
                </button>
              )}
              {["receiving", "in_progress", "problem", "mis_sort"].includes(order.status) && (
                <button onClick={() => handleStatusChange("received")} disabled={loading}>
                  Завершить приёмку
                </button>
              )}
              {["created", "ready_for_receiving", "receiving"].includes(order.status) && (
                <button
                  className="ghost"
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={loading}
                >
                  Отменить поставку
                </button>
              )}
            </div>

            <Notice tone="info">
              После завершения приёмки проверьте фактические количества и статусы строк. Излишки
              подсветятся жёлтым, пересорт — красным.
            </Notice>
          </>
        )}
      </Card>

      <Card title="Строки поставки (заявлено / факт)">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Заявлено</th>
                <th>Факт</th>
                <th>Статус строки</th>
                <th>Ячейка</th>
              </tr>
            </thead>
            <tbody>
              {order?.lines.map((line) => {
                const item = items.find((i) => i.id === line.item_id);
                const loc = locations.find((l) => l.id === line.location_id);
                const zone = loc?.zone_id ? zoneById[loc.zone_id] : undefined;
                return (
                  <tr key={line.id} style={{ background: lineColor(line) }}>
                    <td>{item ? `${item.name} (${item.sku})` : `ID ${line.item_id}`}</td>
                    <td>{line.expected_qty}</td>
                    <td>{line.received_qty}</td>
                    <td>{lineStatusLabel(line.line_status)}</td>
                    <td>
                      {loc ? (
                        <>
                          {loc.code} {zone ? `(${zone.name})` : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {!order?.lines.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Строки не найдены
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
