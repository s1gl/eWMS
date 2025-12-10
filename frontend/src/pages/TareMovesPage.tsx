import { useMemo, useState } from "react";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import { fetchZones } from "../api/zones";
import { fetchLocations } from "../api/locations";
import { getTares, getTareItems, moveTare } from "../api/tares";
import type { Zone } from "../types/zone";
import type { Location } from "../types/location";
import type { Tare, TareItemWithItem } from "../types/tare";

export default function TareMovesPage() {
  const [tareCode, setTareCode] = useState("");
  const [tare, setTare] = useState<Tare | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<TareItemWithItem[]>([]);

  const [targetZoneId, setTargetZoneId] = useState<string>("");
  const [targetLocationId, setTargetLocationId] = useState<string>("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locationMap = useMemo(() => {
    const map: Record<number, Location> = {};
    locations.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [locations]);

  const zoneMap = useMemo(() => {
    const map: Record<number, Zone> = {};
    zones.forEach((z) => {
      map[z.id] = z;
    });
    return map;
  }, [zones]);
  const zoneTypeLabel = (z?: Zone | null) => {
    if (!z) return "";
    if (z.zone_type === "storage") return "хранение";
    if (z.zone_type === "inbound") return "приёмка";
    if (z.zone_type === "outbound") return "отгрузка";
    return z.zone_type;
  };
  const statusLabel = (status: Tare["status"]) => {
    const map: Record<Tare["status"], string> = {
      inbound: "приёмка",
      storage: "хранение",
      picking: "отбор",
      outbound: "отгрузка",
      closed: "закрыта",
    };
    return map[status] || status;
  };

  const storageZones = useMemo(
    () => zones.filter((z) => z.zone_type === "storage"),
    [zones]
  );

  const storageLocations = useMemo(() => {
    const zoneId = Number(targetZoneId);
    return locations.filter(
      (l) => l.is_active && (!zoneId || l.zone_id === zoneId)
    );
  }, [locations, targetZoneId]);

  const sourceLocation = tare?.location_id
    ? locationMap[tare.location_id] || null
    : null;
  const sourceZone =
    sourceLocation && sourceLocation.zone_id
      ? zoneMap[sourceLocation.zone_id]
      : null;

  const loadContext = async (t: Tare) => {
    const [zn, locs, its] = await Promise.all([
      fetchZones({ warehouse_id: t.warehouse_id }),
      fetchLocations({ warehouse_id: t.warehouse_id }),
      getTareItems(t.id),
    ]);
    setZones(zn);
    setLocations(locs);
    setItems(its);
    const currentLocation = t.location_id
      ? locs.find((l) => l.id === t.location_id)
      : null;
    const currentZoneId = currentLocation?.zone_id;
    const storageCandidate =
      currentZoneId && zn.some((z) => z.id === currentZoneId && z.zone_type === "storage")
        ? String(currentZoneId)
        : zn.find((z) => z.zone_type === "storage")?.id;
    setTargetZoneId(storageCandidate ? String(storageCandidate) : "");
    setTargetLocationId("");
  };

  const handleSearch = async () => {
    if (!tareCode.trim()) {
      setError("Введите код тары");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setTare(null);
    setItems([]);
    try {
      const list = await getTares({ code: tareCode.trim() });
      if (!list.length) {
        setError("Тара не найдена");
        return;
      }
      const found = list[0];
      setTare(found);
      await loadContext(found);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить данные по таре");
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async () => {
    if (!tare) {
      setError("Сначала найдите тару");
      return;
    }
    if (!targetLocationId) {
      setError("Выберите целевую ячейку");
      return;
    }
    if (tare.location_id === Number(targetLocationId)) {
      setError("Тара уже в этой ячейке");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await moveTare(tare.id, Number(targetLocationId));
      setTare(updated);
      await loadContext(updated);
      setMessage("Тара перемещена");
    } catch (e: any) {
      setError(e.message || "Не удалось переместить тару");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="page"
      style={{
        height: "100%",
        minHeight: 0,
        gap: 10,
      }}
    >
      <div>
        <h2 style={{ margin: 0 }}>Перемещения тары</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Перемещение тары внутри зоны хранения. Найдите тару по коду и выберите новую ячейку.
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32% 68%",
          gap: 10,
          height: "100%",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            height: "100%",
            minHeight: 0,
          }}
        >
          <Card title="Поиск тары" style={{ padding: 10 }}>
            <div className="form" style={{ margin: 0 }}>
              <FormField label="Код тары">
                <input
                  value={tareCode}
                  onChange={(e) => setTareCode(e.target.value)}
                  placeholder="Отсканируйте или введите код"
                />
              </FormField>
            </div>
            <div className="actions-row" style={{ marginTop: 8 }}>
              <button type="button" onClick={handleSearch} disabled={loading}>
                Найти
              </button>
            </div>
          </Card>

          <Card title="Тара" style={{ padding: 10 }}>
            {tare ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Код
                  </div>
                  <div style={{ fontWeight: 600 }}>{tare.tare_code}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Статус
                    </div>
                    <div>{statusLabel(tare.status)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Склад
                    </div>
                    <div>#{tare.warehouse_id}</div>
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Текущая ячейка
                  </div>
                  <div>
                    {sourceLocation ? sourceLocation.code : "Нет ячейки"}{" "}
                    {sourceZone ? `(${zoneTypeLabel(sourceZone)})` : ""}
                  </div>
                </div>
              </div>
            ) : (
              <div className="muted">Найдите тару, чтобы продолжить</div>
            )}
          </Card>

          <Card title="Новая ячейка" style={{ padding: 10 }}>
            <div className="form" style={{ gap: 8 }}>
              <FormField label="Зона хранения">
                <select
                  value={targetZoneId}
                  onChange={(e) => {
                    setTargetZoneId(e.target.value);
                    setTargetLocationId("");
                  }}
                  disabled={!tare}
                >
                  <option value="">Выберите зону</option>
                  {storageZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Ячейка назначения">
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  disabled={!tare || !targetZoneId}
                >
                  <option value="">Выберите ячейку</option>
                  {storageLocations.map((l) => (
                    <option
                      key={l.id}
                      value={l.id}
                      disabled={tare?.location_id === l.id}
                    >
                      {l.code}
                      {tare?.location_id === l.id ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="actions-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" onClick={handleMove} disabled={loading || !tare}>
                Переместить
              </button>
            </div>
          </Card>
        </div>

        <Card
          title="Содержимое тары"
          style={{
            padding: 10,
            height: "100%",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="table-wrapper" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {tare ? (
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Товар</th>
                    <th>Кол-во</th>
                    <th>Ед.</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ti) => (
                    <tr key={ti.id}>
                      <td>{ti.item_sku}</td>
                      <td>{ti.item_name}</td>
                      <td>{ti.quantity}</td>
                      <td>{ti.item_unit}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>
                        Тара пустая
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="muted" style={{ padding: 8 }}>
                Найдите тару, чтобы увидеть содержимое
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
