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
import { ZoneType, type Zone } from "../types/zone";
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

  const inboundLocations = useMemo(() => {
    const zoneMap = zones.reduce<Record<number, Zone>>((acc, z) => {
      acc[z.id] = z;
      return acc;
    }, {});
    return locations.filter((loc) => {
      if (!loc.zone_id) return false;
      const z = zoneMap[loc.zone_id];
      return z?.zone_type === ZoneType.inbound;
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
    return locs.filter((l) => l.zone_id && zmap[l.zone_id]?.zone_type === ZoneType.inbound);
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
    const placeId = Number(form.placement_location_id);
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

  return (
    <div className="page" style={{ width: "100%" }}>
      <Card title="Приёмка (работа через тару)">
        <p className="muted">
          Выберите поставку, создайте или выберите тару, укажите товар, его состояние и количество. После завершения
          сессии разместите тару в ячейке зоны приёмки.
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
                    Строка #{ln.id} • {it ? it.name : `товар ${ln.item_id}`} • принято {ln.received_qty}/{ln.expected_qty}
                  </option>
                );
              })}
            </select>
          </FormField>
        </div>
      </Card>

      {order && (
        <div className="grid two">
          <Card title="Тара">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Код</th>
                    <th>Ячейка</th>
                  </tr>
                </thead>
                <tbody>
                  {tares.map((t) => {
                    const tt = tareTypes.find((x) => x.id === t.type_id);
                    const loc = locations.find((l) => l.id === t.location_id);
                    return (
                      <tr key={t.id}>
                        <td>{tt ? tt.name : t.type_id}</td>
                        <td>{t.tare_code}</td>
                        <td>{loc ? loc.code : "—"}</td>
                      </tr>
                    );
                  })}
                  {tares.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center" }}>
                        Тары пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="form inline" style={{ marginTop: 12 }}>
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
              <button type="button" onClick={handleCreateTare} disabled={loading || !order}>
                Создать тару
              </button>
            </div>
          </Card>

          <Card title="Принять товар">
            <form className="form" onSubmit={handleReceive}>
              <FormField label="Товар (по строке или поиск SKU/штрихкода)">
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

          <Card title="Сохранить приёмку и разместить тару">
            <div className="form inline">
              <FormField label="Ячейка зоны приёмки">
                <select
                  value={form.placement_location_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, placement_location_id: e.target.value }))}
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
              <button
                type="button"
                onClick={handleCloseTare}
                disabled={loading || !form.tare_id || !form.placement_location_id || !order}
              >
                Сохранить приёмку
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
