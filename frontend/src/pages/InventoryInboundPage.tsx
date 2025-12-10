import { FormEvent, useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import {
  getInboundOrders,
  getInboundOrder,
  receiveInboundLine,
  closeInboundTare,
} from "../api/inbound";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import { fetchZones } from "../api/zones";
import { createTare, getTareTypes, getTares } from "../api/tares";
import type { InboundOrder, InboundStatus } from "../types/inbound";
import type { Item } from "../types";
import type { Location } from "../types/location";
import type { Zone } from "../types/zone";
import type { Tare, TareType } from "../types/tare";

type ReceiveForm = {
  order_id: string;
  line_id: string;
  item_id: string;
  qty: string;
  tare_id: string;
  condition: string;
  placement_location_id: string;
};

const statusLabels: Record<InboundStatus, string> = {
  created: "Создана",
  ready_for_receiving: "Готова к приёмке",
  receiving: "В приёмке",
  received: "Принята",
  cancelled: "Отменена",
  problem: "Проблема",
  mis_sort: "Пересорт",
  draft: "Готова к приёмке",
  in_progress: "В приёмке",
  completed: "Принята",
};

export default function InventoryInboundPage() {
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [order, setOrder] = useState<InboundOrder | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tares, setTares] = useState<Tare[]>([]);
  const [tareTypes, setTareTypes] = useState<TareType[]>([]);
  const [newTareTypeId, setNewTareTypeId] = useState<string>("");
  const [itemQuery, setItemQuery] = useState("");
  const [form, setForm] = useState<ReceiveForm>({
    order_id: "",
    line_id: "",
    item_id: "",
    qty: "",
    tare_id: "",
    condition: "good",
    placement_location_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [selectedPlacement, setSelectedPlacement] = useState<string>("");

  const selectableOrders = useMemo(
    () =>
      orders.filter((o) =>
        ["receiving", "received", "in_progress", "completed", "ready_for_receiving", "created"].includes(
          o.status
        )
      ),
    [orders]
  );

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

  useEffect(() => {
    const load = async () => {
      try {
        const [ords, it, tt] = await Promise.all([getInboundOrders(), fetchItems(), getTareTypes()]);
        setOrders(ords);
        setItems(it);
        setTareTypes(tt);
      } catch (e: any) {
        setError(e.message || "Не удалось загрузить данные");
      }
    };
    load();
  }, []);

  const inboundLocationsFrom = (locs: Location[], zn: Zone[]) => {
    const zmap = zn.reduce<Record<number, Zone>>((acc, z) => {
      acc[z.id] = z;
      return acc;
    }, {});
    return locs.filter((l) => l.zone_id && zmap[l.zone_id]?.zone_type === "inbound");
  };

  const loadOrderDetails = async (orderId: number) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const ord = await getInboundOrder(orderId);
      const [locs, zn, tr] = await Promise.all([
        fetchLocations({ warehouse_id: ord.warehouse_id }),
        fetchZones({ warehouse_id: ord.warehouse_id }),
        getTares({ warehouse_id: ord.warehouse_id }),
      ]);
      setOrder(ord);
      setLocations(locs);
      setZones(zn);
      setTares(tr);
      const inboundLoc = inboundLocationsFrom(locs, zn)[0];
      setForm({
        order_id: String(orderId),
        line_id: "",
        item_id: "",
        qty: "",
        tare_id: tr[0]?.id ? String(tr[0].id) : "",
        condition: "good",
        placement_location_id: inboundLoc ? String(inboundLoc.id) : "",
      });
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить поставку");
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!order) return;
    const lineId = form.line_id ? Number(form.line_id) : undefined;
    const itemId = form.item_id ? Number(form.item_id) : undefined;
    const qty = Number(form.qty);
    const tareId = Number(form.tare_id);
    if (!lineId && !itemId) return setError("Укажите строку или товар");
    if (!tareId) return setError("Выберите тару");
    if (!qty || qty <= 0) return setError("Количество должно быть больше нуля");

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await receiveInboundLine(order.id, {
        line_id: lineId,
        item_id: itemId,
        qty,
        tare_id: tareId,
        condition: form.condition,
      });
      setOrder(updated);
      setMessage("Приёмка зафиксирована");
      setForm((prev) => ({ ...prev, qty: "" }));
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
      setForm((prev) => ({ ...prev, tare_id: String(tare.id) }));
      setMessage("Тара создана");
    } catch (e: any) {
      setError(e.message || "Не удалось создать тару");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTare = async () => {
    if (!order) return;
    const tareId = Number(form.tare_id);
    const placeId = Number(selectedPlacement || form.placement_location_id);
    if (!tareId) return setError("Выберите тару перед размещением");
    if (!placeId) return setError("Выберите ячейку приёмки");
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await closeInboundTare(order.id, {
        tare_id: tareId,
        location_id: placeId,
      });
      setOrder(updated);
      setMessage("Тара закрыта и размещена");
      const tr = await getTares({ warehouse_id: order.warehouse_id });
      setTares(tr);
      setShowPlacementModal(false);
    } catch (e: any) {
      setError(e.message || "Не удалось закрыть тару");
    } finally {
      setLoading(false);
    }
  };

  const selectedLine = order?.lines.find((l) => l.id === Number(form.line_id));
  const lineItem = selectedLine ? items.find((i) => i.id === selectedLine.item_id) : null;

  const lineColor = (ln: InboundOrder["lines"][number]) => {
    if (ln.expected_qty === 0 || ln.line_status === "mis_sort") return "#ffe5e5";
    if (ln.received_qty > ln.expected_qty) return "#fff5cc";
    if (ln.expected_qty > 0 && ln.received_qty === ln.expected_qty) return "#e8f9e8";
    return "transparent";
  };

  const lineStatusLabel = (status?: string | null) => {
    if (!status) return "—";
    const map: Record<string, string> = {
      open: "Открыта",
      partially_received: "Частично",
      fully_received: "Принято",
      cancelled: "Отменена",
      over_received: "Излишек",
      mis_sort: "Пересорт",
      good: "Годен",
      defect: "Брак",
      quarantine: "Карантин",
    };
    return map[status] || status;
  };

  return (
    <div
      className="page"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "2px 4px" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Приёмка (работа через тару)</h2>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Выберите поставку, принимайте товар в тару и размещайте её в ячейке зоны приёмки.
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32% 68%",
          gap: "8px",
          alignItems: "start",
          width: "100%",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          marginTop: 2,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "6px",
            alignItems: "start",
            position: "sticky",
            top: 4,
          }}
        >
          <Card title="Поставка" style={{ marginBottom: 0, padding: 8 }}>
            <div className="form" style={{ gap: 6, margin: 0 }}>
              <FormField label="Поставка">
                <select
                  value={form.order_id}
                  onChange={(e) => {
                    const oid = Number(e.target.value);
                    setForm((prev) => ({ ...prev, order_id: e.target.value, line_id: "", item_id: "" }));
                    if (oid) loadOrderDetails(oid);
                  }}
                >
                  <option value="">Выберите поставку</option>
                  {selectableOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id} {o.external_number ? `(${o.external_number})` : ""} — {statusLabels[o.status] || o.status}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </Card>

          <Card title="Тара" style={{ marginBottom: 0, padding: 8 }}>
            <div className="form inline" style={{ gap: 6, margin: 0 }}>
              <FormField label="Тип тары">
                <select value={newTareTypeId} onChange={(e) => setNewTareTypeId(e.target.value)}>
                  <option value="">Выберите тип</option>
                  {tareTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} ({tt.code})
                    </option>
                  ))}
                </select>
              </FormField>
              <button type="button" onClick={handleCreateTare} disabled={loading || !order || !newTareTypeId}>
                Создать
              </button>
            </div>
            <FormField label="Тара" style={{ marginTop: 6 }}>
              <select value={form.tare_id} onChange={(e) => setForm((prev) => ({ ...prev, tare_id: e.target.value }))}>
                <option value="">Выберите тару</option>
                {tares.map((t) => {
                  const tt = tareTypes.find((x) => x.id === t.type_id);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.tare_code} {tt ? `(${tt.name})` : ""}
                    </option>
                  );
                })}
              </select>
            </FormField>
          </Card>

          <Card title="Принять товар" style={{ marginBottom: 0, padding: 8 }}>
            <form className="form" onSubmit={handleReceive} style={{ gap: 6, margin: 0 }}>
              <FormField label="Товар (поиск по SKU/штрихкоду)">
                <input
                  value={lineItem ? `${lineItem.name} (${lineItem.sku})` : ""}
                  placeholder="Найдите товар"
                  readOnly
                />
                <div style={{ marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="Поиск товара (SKU, штрихкод, название)"
                    value={itemQuery}
                    onChange={async (e) => {
                      const q = e.target.value;
                      setItemQuery(q);
                      const list = await fetchItems({ query: q });
                      setItems(list);
                      const found = list.find((it) => it.sku === q || it.barcode === q);
                      if (found) {
                        setForm((prev) => ({ ...prev, item_id: String(found.id), line_id: "" }));
                      }
                    }}
                  />
                </div>
              </FormField>

              <div className="form inline" style={{ gap: 6, margin: 0 }}>
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

                <FormField label="Сколько принять">
                  <input
                    type="number"
                    min={1}
                    value={form.qty}
                    onChange={(e) => setForm((prev) => ({ ...prev, qty: e.target.value }))}
                    placeholder="Количество"
                  />
                </FormField>
              </div>

              <div className="actions-row" style={{ marginTop: 4, justifyContent: "flex-end" }}>
                <button type="submit" disabled={loading || !order}>
                  Принять
                </button>
              </div>
            </form>
          </Card>

          <Card title="Сохранить приёмку и разместить тару" style={{ marginBottom: 0, padding: 8 }}>
            <div className="actions-row" style={{ marginTop: 2 }}>
              <button
                type="button"
                onClick={() => {
                  const defaultPlacement =
                    selectedPlacement ||
                    form.placement_location_id ||
                    (inboundLocations[0] ? String(inboundLocations[0].id) : "");
                  setSelectedPlacement(defaultPlacement);
                  setShowPlacementModal(true);
                }}
                disabled={loading || !form.tare_id || !order}
              >
                Сохранить приёмку
              </button>
            </div>
          </Card>
        </div>

        <Card
          title="Строки поставки"
          style={{
            padding: 8,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
          }}
        >
          <div
            className="table-wrapper"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Состояние</th>
                  <th>Заявлено</th>
                  <th>Факт</th>
                  <th>Статус</th>
                  <th>Ячейка</th>
                </tr>
              </thead>
              <tbody>
                {order
                  ? order.lines.map((ln) => {
                      const it = items.find((i) => i.id === ln.item_id);
                      const loc = locations.find((l) => l.id === ln.location_id);
                      return (
                        <tr key={ln.id} style={{ background: lineColor(ln) }}>
                          <td>{it ? `${it.name} (${it.sku})` : `ID ${ln.item_id}`}</td>
                          <td>{lineStatusLabel(ln.line_status)}</td>
                          <td>{ln.expected_qty}</td>
                          <td>{ln.received_qty}</td>
                          <td>{lineStatusLabel(ln.line_status)}</td>
                          <td>{loc ? loc.code : "—"}</td>
                        </tr>
                      );
                    })
                  : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center" }}>
                        Выберите поставку
                      </td>
                    </tr>
                    )}
                {order && order.lines.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
                      Строки не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showPlacementModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Разместить тару</h3>
            <FormField label="Ячейка зоны приёмки">
              <select
                value={selectedPlacement}
                onChange={(e) => setSelectedPlacement(e.target.value)}
              >
                <option value="">Выберите ячейку</option>
                {inboundLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="actions-row">
              <button onClick={handleCloseTare} disabled={loading || !selectedPlacement}>
                Разместить тару
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() => setShowPlacementModal(false)}
                disabled={loading}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
