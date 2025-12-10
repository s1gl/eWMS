import { FormEvent, useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import { getInboundOrders, getInboundOrder, receiveInboundLine } from "../api/inbound";
import { fetchItems } from "../api/items";
import { fetchLocations } from "../api/locations";
import { fetchZones } from "../api/zones";
import { createTare, getTareTypes, getTares } from "../api/tares";
import type { InboundOrder, InboundStatus } from "../types/inbound";
import type { Item } from "../types";
import type { Location } from "../types/location";
import type { Zone, ZoneType } from "../types/zone";
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
      return z?.zone_type === "inbound";
    });
  }, [locations, zones]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ords, it, tt] = await Promise.all([
          getInboundOrders({ status: "in_progress" }),
          fetchItems(),
          getTareTypes(),
        ]);
        setOrders(ords);
        setItems(it);
        setTareTypes(tt);
      } catch (e: any) {
        setError(e.message || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ");
      }
    };
    load();
  }, []);

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
      setForm({
        order_id: String(orderId),
        line_id: firstLine ? String(firstLine.id) : "",
        item_id: firstLine ? String(firstLine.item_id) : "",
        qty: "",
        tare_id: tr[0]?.id ? String(tr[0].id) : "",
        condition: "good",
        placement_location_id: inboundLocationsFrom(locs, zn)[0]?.id
          ? String(inboundLocationsFrom(locs, zn)[0].id)
          : "",
      });
    } catch (e: any) {
      setError(e.message || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїРѕСЃС‚Р°РІРєСѓ");
    } finally {
      setLoading(false);
    }
  };

  const inboundLocationsFrom = (locs: Location[], zn: Zone[]) => {
    const zmap = zn.reduce<Record<number, Zone>>((acc, z) => {
      acc[z.id] = z;
      return acc;
    }, {});
    return locs.filter((l) => l.zone_id && zmap[l.zone_id]?.zone_type === ZoneType.inbound);
  };

  const handleReceive = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!order) return;
    const lineId = Number(form.line_id);
    const qty = Number(form.qty);
    const tareId = Number(form.tare_id);
    if (!lineId) return setError("Выберите строку поставки");
    if (!tareId) return setError("Выберите тару");
    if (!qty || qty <= 0) return setError("Количество должно быть больше нуля");

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await receiveInboundLine(order.id, {
        line_id: lineId,
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
      setError("Р’С‹Р±РµСЂРёС‚Рµ С‚РёРї С‚Р°СЂС‹");
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
      setMessage("РўР°СЂР° СЃРѕР·РґР°РЅР°");
    } catch (e: any) {
      setError(e.message || "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ С‚Р°СЂСѓ");
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
        placement_location_id: placeId,
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

  const activeOrders = orders.filter(
    (o) => o.status === "receiving" || o.status === "in_progress"
  );

  const selectedLine = order?.lines.find((l) => l.id === Number(form.line_id));
  const item = items.find((i) => i.id === selectedLine?.item_id);

  return (
    <div className="page">
      <Card title="РџСЂРёС‘РјРєР° (С‡РµСЂРµР· С‚Р°СЂСѓ)">
        <p className="muted">
          Р—РґРµСЃСЊ РјРѕР¶РЅРѕ РїСЂРёРЅСЏС‚СЊ С‚РѕРІР°СЂ С‚РѕР»СЊРєРѕ РІ СЏС‡РµР№РєСѓ Р·РѕРЅС‹ РїСЂРёС‘РјРєРё Рё С‚РѕР»СЊРєРѕ С‡РµСЂРµР· РІС‹Р±СЂР°РЅРЅСѓСЋ С‚Р°СЂСѓ.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <div className="form inline">
          <FormField label="РџРѕСЃС‚Р°РІРєР°">
            <select
              value={form.order_id}
              onChange={(e) => {
                const oid = Number(e.target.value);
                setForm((prev) => ({ ...prev, order_id: e.target.value }));
                if (oid) loadOrderDetails(oid);
              }}
            >
              <option value="">Р’С‹Р±РµСЂРёС‚Рµ РїРѕСЃС‚Р°РІРєСѓ РІ СЃС‚Р°С‚СѓСЃРµ вЂњР’ РїСЂРёС‘РјРєРµвЂќ</option>
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  в„–{o.id} {o.external_number ? `(${o.external_number})` : ""} вЂ”{" "}
                  {statusLabels[o.status] || o.status}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="РЎС‚СЂРѕРєР° РїРѕСЃС‚Р°РІРєРё">
            <select
              value={form.line_id}
              onChange={(e) => {
                const lineId = Number(e.target.value);
                const ln = order?.lines.find((l) => l.id === lineId);
                setForm((prev) => ({
                  ...prev,
                  line_id: e.target.value,
                  item_id: ln ? String(ln.item_id) : "",
                }));
              }}
              disabled={!order}
            >
              <option value="">Р’С‹Р±РµСЂРёС‚Рµ СЃС‚СЂРѕРєСѓ</option>
              {order?.lines.map((ln) => (
                <option key={ln.id} value={ln.id}>
                  РЎС‚СЂРѕРєР° #{ln.id} вЂў С‚РѕРІР°СЂ {ln.item_id} вЂў РїСЂРёРЅСЏС‚Рѕ {ln.received_qty}/{ln.expected_qty}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </Card>

      {order && (
        <div className="grid two">
          <Card title="РўР°СЂР°">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>РўРёРї</th>
                    <th>РљРѕРґ</th>
                    <th>РЇС‡РµР№РєР°</th>
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
                        <td>{loc ? loc.code : "вЂ”"}</td>
                      </tr>
                    );
                  })}
                  {tares.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center" }}>
                        РўР°СЂС‹ РїРѕРєР° РЅРµС‚
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="form inline" style={{ marginTop: 12 }}>
              <FormField label="РўРёРї С‚Р°СЂС‹">
                <select
                  value={newTareTypeId}
                  onChange={(e) => setNewTareTypeId(e.target.value)}
                >
                  <option value="">Р’С‹Р±РµСЂРёС‚Рµ С‚РёРї</option>
                  {tareTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} ({tt.code})
                    </option>
                  ))}
                </select>
              </FormField>
              <button type="button" onClick={handleCreateTare} disabled={loading || !order}>
                РЎРѕР·РґР°С‚СЊ С‚Р°СЂСѓ
              </button>
            </div>
          </Card>

          <Card title="РџСЂРёРЅСЏС‚СЊ С‚РѕРІР°СЂ">
            <form className="form" onSubmit={handleReceive}>
              <FormField label="РўРѕРІР°СЂ">
                <input value={item ? `${item.name} (${item.sku})` : ""} readOnly />
              </FormField>
              <FormField label="РЎРєРѕР»СЊРєРѕ РїСЂРёРЅСЏС‚СЊ">
                <input
                  type="number"
                  min={1}
                  value={form.qty}
                  onChange={(e) => setForm((prev) => ({ ...prev, qty: e.target.value }))}
                  placeholder="РљРѕР»РёС‡РµСЃС‚РІРѕ"
                />
              </FormField>
              <FormField label="РЇС‡РµР№РєР° Р·РѕРЅС‹ РїСЂРёС‘РјРєРё">
                <select
                  value={form.placement_location_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, placement_location_id: e.target.value }))}
                >
                  <option value="">Р’С‹Р±РµСЂРёС‚Рµ СЏС‡РµР№РєСѓ РїСЂРёС‘РјРєРё</option>
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
              <FormField label="РўР°СЂР°">
                <select
                  value={form.tare_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, tare_id: e.target.value }))}
                >
                  <option value="">Р’С‹Р±РµСЂРёС‚Рµ С‚Р°СЂСѓ</option>
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
                  disabled={
                    loading ||
                    !form.order_id ||
                    !form.line_id ||
                    !form.placement_location_id ||
                    !form.tare_id
                  }
                >
                  {loading ? "РџСЂРёРЅРёРјР°РµРј..." : "РџСЂРёРЅСЏС‚СЊ"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
