import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { changeInboundStatus, getInboundOrder, receiveInboundLine } from "../api/inbound";
import { fetchWarehouses } from "../api/warehouses";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import { fetchZones } from "../api/zones";
import { createTare, getTareTypes, getTares } from "../api/tares";
import { InboundOrder, InboundOrderLine, InboundStatus } from "../types/inbound";
import { Warehouse } from "../types/warehouse";
import { Item } from "../types";
import { Location } from "../types/location";
import { Zone } from "../types/zone";
import { Tare, TareType } from "../types/tare";
import Card from "../components/Card";
import Notice from "../components/Notice";
import FormField from "../components/FormField";

type LineForm = { qty: string; location_id: string; tare_id: string };

const statusLabels: Record<InboundStatus, string> = {
  draft: "Черновик",
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
    over_received: "Принято больше, чем ожидалось",
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
  const [tares, setTares] = useState<Tare[]>([]);
  const [tareTypes, setTareTypes] = useState<TareType[]>([]);
  const [newTareTypeId, setNewTareTypeId] = useState<string>("");

  const [forms, setForms] = useState<Record<number, LineForm>>({});
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

  const inboundLocations = useMemo(() => {
    const zoneMap = zones.reduce<Record<number, Zone>>((acc, z) => {
      acc[z.id] = z;
      return acc;
    }, {});
    return locations.filter((loc) => {
      if (!loc.zone_id) return false;
      const z = zoneMap[loc.zone_id];
      return z?.zone_type === "inbound";
    });
  }, [locations, zones]);

  const locationLabel = (locId?: number | null) => {
    if (!locId) return "—";
    const loc = locations.find((l) => l.id === locId);
    if (!loc) return `ID ${locId}`;
    const zone = zones.find((z) => z.id === loc.zone_id);
    return zone ? `${loc.code} (${zone.code})` : loc.code;
  };

  const warehouseName = useMemo(() => {
    if (!order) return "";
    const wh = warehouses.find((w) => w.id === order.warehouse_id);
    return wh ? `${wh.name} (${wh.code})` : `ID ${order.warehouse_id}`;
  }, [order, warehouses]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const ord = await getInboundOrder(orderId);
      const [wh, it, loc, zn, trTypes, tr] = await Promise.all([
        fetchWarehouses(),
        fetchItems(),
        fetchLocations({ warehouse_id: ord.warehouse_id }),
        fetchZones({ warehouse_id: ord.warehouse_id }),
        getTareTypes(),
        getTares({ warehouse_id: ord.warehouse_id }),
      ]);
      setOrder(ord);
      setWarehouses(wh);
      setItems(it);
      setLocations(loc);
      setZones(zn);
      setTareTypes(trTypes);
      setTares(tr);
      setForms(
        ord.lines.reduce<Record<number, LineForm>>((acc, line) => {
          acc[line.id] = {
            qty: "",
            location_id: (line.location_id ?? "").toString(),
            tare_id: tr[0]?.id ? String(tr[0].id) : "",
          };
          return acc;
        }, {})
      );
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить данные поставки");
    } finally {
      setLoading(false);
    }
  };

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

  const handleReceive = async (
    line: InboundOrderLine,
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!order) return;
    const form = forms[line.id] || { qty: "", location_id: "", tare_id: "" };
    const qty = Number(form.qty);
    const locationId = Number(form.location_id);
    const tareId = Number(form.tare_id);
    if (!locationId) {
      setError("Выберите ячейку приёмки");
      return;
    }
    if (!tareId) {
      setError("Выберите тару");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Количество должно быть больше нуля");
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
        tare_id: tareId,
      });
      setOrder(updated);
      setMessage("Приёмка выполнена");
      setForms((prev) => ({
        ...prev,
        [line.id]: { ...prev[line.id], qty: "" },
      }));
      // обновить список тары после приёмки (локация могла поменяться)
      const tr = await getTares({ warehouse_id: order.warehouse_id });
      setTares(tr);
    } catch (e: any) {
      setError(e.message || "Не удалось выполнить приёмку");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTare = async () => {
    if (!order) return;
    if (!newTareTypeId) {
      setError("Выберите тип тары");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const tare = await createTare({
        warehouse_id: order.warehouse_id,
        type_id: Number(newTareTypeId),
      });
      const tr = await getTares({ warehouse_id: order.warehouse_id });
      setTares(tr);
      // подставим новую тару в формы
      setForms((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          const idNum = Number(key);
          next[idNum] = { ...next[idNum], tare_id: String(tare.id) };
        });
        return next;
      });
      setMessage("Тара создана");
    } catch (e: any) {
      setError(e.message || "Не удалось создать тару");
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
          </>
        )}
      </Card>

      <div className="two-column-layout">
        <Card
          title="Тара"
          actions={
            <div className="actions-row">
              <FormField label="Тип тары">
                <select
                  value={newTareTypeId}
                  onChange={(e) => setNewTareTypeId(e.target.value)}
                >
                  <option value="">Выберите тип</option>
                  {tareTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} ({tt.code})
                    </option>
                  ))}
                </select>
              </FormField>
              <button type="button" onClick={handleCreateTare} disabled={loading}>
                Создать тару
              </button>
            </div>
          }
        >
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Код тары</th>
                  <th>Текущая ячейка</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {tares.map((t) => {
                  const type = tareTypes.find((tt) => tt.id === t.type_id);
                  const loc = locations.find((l) => l.id === t.location_id);
                  return (
                    <tr key={t.id}>
                      <td>{type ? type.name : `ID ${t.type_id}`}</td>
                      <td>{t.tare_code}</td>
                      <td>{loc ? locationLabel(loc.id) : "—"}</td>
                      <td>{t.status}</td>
                    </tr>
                  );
                })}
                {tares.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>
                      Тары пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Строки поставки и приёмка">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Ожидали</th>
                  <th>Принято</th>
                  <th>Статус строки</th>
                  <th>Принять</th>
                </tr>
              </thead>
              <tbody>
                {order?.lines.map((line) => {
                  const item = items.find((i) => i.id === line.item_id);
                  const formState = forms[line.id] || { qty: "", location_id: "", tare_id: "" };
                  return (
                    <tr key={line.id}>
                      <td>{item ? `${item.name} (${item.sku})` : `ID ${line.item_id}`}</td>
                      <td>{line.expected_qty}</td>
                      <td>{line.received_qty}</td>
                      <td>{lineStatusLabel(line.line_status)}</td>
                      <td>
                        {order?.status === "in_progress" ? (
                          <form onSubmit={(e) => handleReceive(line, e)} className="form inline">
                            <FormField label="Ячейка приёмки">
                              <select
                                value={formState.location_id}
                                onChange={(e) =>
                                  setForms((prev) => ({
                                    ...prev,
                                    [line.id]: { ...prev[line.id], location_id: e.target.value },
                                  }))
                                }
                              >
                                <option value="">Выберите ячейку из зоны приёмки</option>
                                {inboundLocations.map((loc) => {
                                  const zone = zones.find((z) => z.id === loc.zone_id);
                                  return (
                                    <option key={loc.id} value={loc.id}>
                                      {loc.code} {zone ? `(${zone.name})` : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </FormField>
                            <FormField label="Тара">
                              <select
                                value={formState.tare_id}
                                onChange={(e) =>
                                  setForms((prev) => ({
                                    ...prev,
                                    [line.id]: { ...prev[line.id], tare_id: e.target.value },
                                  }))
                                }
                              >
                                <option value="">Выберите тару</option>
                                {tares.map((t) => {
                                  const type = tareTypes.find((tt) => tt.id === t.type_id);
                                  return (
                                    <option key={t.id} value={t.id}>
                                      {t.tare_code} {type ? `(${type.name})` : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </FormField>
                            <FormField label="Сколько принять">
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
                                placeholder="Количество"
                              />
                            </FormField>
                            <div className="actions-row">
                              <button type="submit" disabled={loading}>
                                {loading ? "Принимаем..." : "Принять"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <span className="muted">Доступно только в статусе "В приёмке"</span>
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
    </div>
  );
}
