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
  draft: "Готова к приёмке",
  in_progress: "В приёмке",
  completed: "Завершена",
  cancelled: "Отменена",
  problem: "Проблема",
  mis_sort: "Пересорт",
};

const lineStatusLabel = (status?: string | null) => {
  if (!status) return "—";
  const map: Record<string, string> = {
    open: "Открыта",
    partially_received: "Принято частично",
    fully_received: "Принято полностью",
    cancelled: "Отменена",
    over_received: "Принято больше ожидаемого",
    mis_sort: "Пересорт",
  };
  return map[status] || status;
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
      setError("Некорректный идентификатор поставки");
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
      setMessage("Статус обновлён");
    } catch (e: any) {
      setError(e.message || "Не удалось изменить статус");
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

  const titleNumber =
    order?.external_number?.trim() && order?.external_number.trim() !== ""
      ? order.external_number
      : `№-${order?.id ?? orderId}`;

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
              {order.status === "draft" && (
                <button onClick={() => handleStatusChange("in_progress")} disabled={loading}>
                  Начать приёмку
                </button>
              )}
              {order.status === "in_progress" && (
                <button onClick={() => handleStatusChange("completed")} disabled={loading}>
                  Завершить приёмку
                </button>
              )}
            </div>

            <Notice tone="info">
              Приёмка выполняется в разделе “Приёмка”/“Тары”. Здесь — только создание и управление поставками.
            </Notice>
          </>
        )}
      </Card>

      <Card title="Строки поставки (только просмотр)">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Ожидали</th>
                <th>Принято</th>
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
                  <tr key={line.id}>
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
                    Строк пока нет
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
