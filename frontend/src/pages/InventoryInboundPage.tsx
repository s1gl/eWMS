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
      const firstLine = ord.lines[0];
      const inboundLoc = inboundLocationsFrom(locs, zn)[0];
      setForm({
        order_id: String(orderId),
        line_id: firstLine ? String(firstLine.id) : "",
        item_id: firstLine ? String(firstLine.item_id) : "",
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
      setMessage("Приёмка выполнена");
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
    if (!tareId) return setError("Выберите тару для размещения");
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
      setMessage("Тара размещена на приёмке");
      const tr = await getTares({ warehouse_id: order.warehouse_id });
      setTares(tr);
    } catch (e: any) {
      setError(e.message || "Не удалось закрыть тару");
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = orders;

  const selectedLine = order?.lines.find((l) => l.id === Number(form.line_id));
  const lineItem = selectedLine ? items.find((i) => i.id === selectedLine.item_id) : null;

  const lineColor = (ln: InboundOrder["lines"][number]) => {
    if (ln.expected_qty === 0 || ln.line_status === "mis_sort") return "#ffe5e5";
    if (ln.received_qty > ln.expected_qty) return "#fff5cc";
    if (ln.expected_qty > 0 && ln.received_qty === ln.expected_qty) return "#e8f9e8";
    return "transparent";
  };

  return (
    <div className="page" style={{ width: "100%" }}>
      <Card title="Приёмка (работа через тару)">
        <p className="muted">
          Выберите поставку и строку, затем создавайте/выбирайте тару и принимайте товар. После завершения разместите
          тару в ячейке зоны приёмки.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <div className="form inline">
          <FormField label="Поставка">
            <select
              value={form.order_id}
              onChange={(e) => {
                const oid = Number(e.target.value);
                setForm((prev) => ({ ...prev, order_id: e.target.value }));
                if (oid) loadOrderDetails(oid);
              }}
            >
              <option value="">Выберите поставку</option>
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} {o.external_number ? `(${o.external_number})` : ""} — {statusLabels[o.status] || o.status}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Строка поставки">
            <select
              value={form.line_id}
              onChange={(e) => {
                const lineId = Number(e.target.value);
                const ln = order?.lines.find((l) => l.id === lineId);
                setForm((prev) => ({
                  ...prev,
                  line_id: e.target.value,
                  item_id: ln ? String(ln.item_id) : prev.item_id,
                }));
              }}
              disabled={!order}
            >
              <option value="">Выберите строку</option>
              {order?.lines.map((ln) => {
                const it = items.find((i) => i.id === ln.item_id);
                return (
                  <option key={ln.id} value={ln.id}>
                    Строка #{ln.id} • {it ? it.name : `товар ${ln.item_id}`} • принято {ln.received_qty}/
                    {ln.expected_qty}
                  </option>
                );
              })}
            </select>
          </FormField>
        </div>
      </Card>

      {order && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) 2fr",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "12px", alignItems: "start" }}>
            <Card title="Тара">
              <FormField label="Тара">
                <select
                  value={form.tare_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, tare_id: e.target.value }))}
                >
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
              <div className="actions-row">
                <button type="button" onClick={handleCreateTare} disabled={loading || !order}>
                  Создать тару
                </button>
              </div>

              <div className="actions-row">
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

            <Card title="Принять товар">
              <form className="form" onSubmit={handleReceive}>
                <FormField label="Товар (строка или поиск SKU/штрихкода)">
                  <input
                    value={lineItem ? `${lineItem.name} (${lineItem.sku})` : ""}
                    placeholder="Выберите строку или найдите товар"
                    readOnly
                  />
                  <div style={{ marginTop: 8 }}>
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

                <FormField label="Тара (если нужно выбрать другую)">
                  <select
                    value={form.tare_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, tare_id: e.target.value }))}
                  >
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

                <div className="actions-row">
                  <button
                    type="submit"
                    disabled={loading || !form.order_id || (!form.line_id && !form.item_id) || !form.tare_id}
                  >
                    {loading ? "Приёмка..." : "Принять"}
                  </button>
                </div>
              </form>
            </Card>
          </div>

          <Card title="Строки поставки">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Состояние</th>
                    <th>Заявлено</th>
                    <th>Факт</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((ln) => {
                    const it = items.find((i) => i.id === ln.item_id);
                    return (
                      <tr key={ln.id} style={{ backgroundColor: lineColor(ln) }}>
                        <td>{it ? `${it.name} (${it.sku})` : `Товар ${ln.item_id}`}</td>
                        <td>{ln.line_status || "—"}</td>
                        <td>{ln.expected_qty}</td>
                        <td>{ln.received_qty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {showPlacementModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "16px",
              borderRadius: 8,
              width: "400px",
              maxWidth: "90%",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Разместить тару</h3>
            <FormField label="Ячейка зоны приёмки">
              <select
                value={selectedPlacement}
                onChange={(e) => setSelectedPlacement(e.target.value)}
              >
                <option value="">Выберите ячейку приёмки</option>
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
            <div className="actions-row" style={{ marginTop: 12, justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setShowPlacementModal(false)}>
                Отмена
              </button>
              <button
                type="button"
                disabled={!selectedPlacement || loading}
                onClick={async () => {
                  setForm((prev) => ({ ...prev, placement_location_id: selectedPlacement }));
                  await handleCloseTare();
                  setShowPlacementModal(false);
                }}
              >
                Разместить тару
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
