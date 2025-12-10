import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import { fetchWarehouses } from "../api/warehouses";
import { fetchZones } from "../api/zones";
import { fetchLocations } from "../api/locations";
import {
  getTaresForPutaway,
  getTareItems,
  putawayTare,
} from "../api/tares";
import type { Warehouse } from "../types/warehouse";
import type { Zone } from "../types/zone";
import type { Location } from "../types/location";
import type { Tare, TareItemWithItem } from "../types/tare";

export default function PutawayPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tares, setTares] = useState<Tare[]>([]);
  const [selectedTareId, setSelectedTareId] = useState<number | null>(null);
  const [tareItems, setTareItems] = useState<TareItemWithItem[]>([]);

  const [storageZoneId, setStorageZoneId] = useState<string>("");
  const [storageLocationId, setStorageLocationId] = useState<string>("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const wh = await fetchWarehouses();
        setWarehouses(wh);
        if (wh.length > 0) {
          setSelectedWarehouseId(String(wh[0].id));
        }
      } catch (e: any) {
        setError(e.message || "Failed to load warehouses");
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    const wid = Number(selectedWarehouseId);
    setMessage(null);
    setError(null);
    loadReference(wid);
  }, [selectedWarehouseId]);

  const loadReference = async (warehouseId: number) => {
    setListLoading(true);
    setError(null);
    setSelectedTareId(null);
    setTareItems([]);
    try {
      const [zn, locs, tr] = await Promise.all([
        fetchZones({ warehouse_id: warehouseId }),
        fetchLocations({ warehouse_id: warehouseId }),
        getTaresForPutaway(warehouseId),
      ]);
      setZones(zn);
      setLocations(locs);
      setTares(tr);
      const firstStorage = zn.find((z) => z.zone_type === "storage");
      setStorageZoneId(firstStorage ? String(firstStorage.id) : "");
      setStorageLocationId("");
    } catch (e: any) {
      setError(e.message || "Failed to load put-away data");
    } finally {
      setListLoading(false);
    }
  };

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

  const storageZones = useMemo(
    () => zones.filter((z) => z.zone_type === "storage"),
    [zones]
  );
  const storageLocations = useMemo(() => {
    const zoneId = Number(storageZoneId);
    return locations.filter(
      (l) => l.is_active && (!zoneId || l.zone_id === zoneId)
    );
  }, [locations, storageZoneId]);

  const selectedTare = useMemo(
    () => tares.find((t) => t.id === selectedTareId) || null,
    [selectedTareId, tares]
  );

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === Number(selectedWarehouseId)) || null,
    [warehouses, selectedWarehouseId]
  );

  const sourceLocation = selectedTare?.location_id
    ? locationMap[selectedTare.location_id] || null
    : null;
  const sourceZone =
    sourceLocation && sourceLocation.zone_id
      ? zoneMap[sourceLocation.zone_id]
      : null;

  const handleSelectTare = async (t: Tare) => {
    setSelectedTareId(t.id);
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const items = await getTareItems(t.id);
      setTareItems(items);
      if (!storageZoneId && storageZones.length > 0) {
        setStorageZoneId(String(storageZones[0].id));
      }
    } catch (e: any) {
      setError(e.message || "Failed to load tare items");
    } finally {
      setLoading(false);
    }
  };

  const handlePutaway = async () => {
    if (!selectedTare) {
      setError("Select a tare first");
      return;
    }
    if (!storageLocationId) {
      setError("Choose a storage location");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await putawayTare(selectedTare.id, Number(storageLocationId));
      setMessage("Tare moved to storage");
      await loadReference(selectedTare.warehouse_id);
    } catch (e: any) {
      setError(e.message || "Failed to put-away tare");
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
        <h2 style={{ margin: 0 }}>Put-away</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Move received tares from inbound to storage locations. Lists refresh
          after each placement.
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32% 68%",
          gap: 10,
          flex: 1,
          minHeight: 0,
          height: "100%",
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
          <Card title="Inbound tares" style={{ padding: 10, flex: 1, minHeight: 0 }}>
            <div className="form" style={{ marginBottom: 8 }}>
              <FormField label="Warehouse">
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 6,
                height: "100%",
                minHeight: 0,
                overflowY: "auto",
                background: "#f8fafc",
              }}
            >
              {listLoading && <div className="muted">Loading...</div>}
              {!listLoading && tares.length === 0 && (
                <div className="muted">No tares in inbound zone</div>
              )}
              {!listLoading &&
                tares.map((t) => {
                  const loc = t.location_id
                    ? locationMap[t.location_id]
                    : undefined;
                  const zn = loc?.zone_id ? zoneMap[loc.zone_id] : undefined;
                  const active = selectedTareId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTare(t)}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        marginBottom: 6,
                        cursor: "pointer",
                        background: active ? "#eff6ff" : "#fff",
                        border: active ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{t.tare_code}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {loc ? `Loc: ${loc.code}` : "No location"}{" "}
                        {zn ? `(${zn.zone_type})` : ""}
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          <Card title="Placement" style={{ padding: 10 }}>
            <div className="form" style={{ gap: 8 }}>
              <FormField label="Storage zone">
                <select
                  value={storageZoneId}
                  onChange={(e) => {
                    setStorageZoneId(e.target.value);
                    setStorageLocationId("");
                  }}
                >
                  <option value="">Select zone</option>
                  {storageZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Storage location">
                <select
                  value={storageLocationId}
                  onChange={(e) => setStorageLocationId(e.target.value)}
                  disabled={!storageZoneId}
                >
                  <option value="">Select location</option>
                  {storageLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="actions-row" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handlePutaway}
                disabled={loading || !selectedTare}
              >
                Place tare
              </button>
            </div>
          </Card>

          <Card title="Selected tare" style={{ padding: 10 }}>
            {selectedTare ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Code
                  </div>
                  <div style={{ fontWeight: 600 }}>{selectedTare.tare_code}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Warehouse
                    </div>
                    <div>
                      {selectedWarehouse
                        ? `${selectedWarehouse.name} (${selectedWarehouse.code})`
                        : selectedTare.warehouse_id}
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Status
                    </div>
                    <div>{selectedTare.status}</div>
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Current location
                  </div>
                  <div>
                    {sourceLocation ? sourceLocation.code : "No location"}{" "}
                    {sourceZone ? `(${sourceZone.zone_type})` : ""}
                  </div>
                </div>
              </div>
            ) : (
              <div className="muted">Pick a tare from the list</div>
            )}
          </Card>
        </div>

        <Card
          title="Tare content"
          style={{
            padding: 10,
            height: "100%",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="table-wrapper" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {selectedTare ? (
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {tareItems.map((ti) => (
                    <tr key={ti.id}>
                      <td>{ti.item_sku}</td>
                      <td>{ti.item_name}</td>
                      <td>{ti.quantity}</td>
                      <td>{ti.item_unit}</td>
                    </tr>
                  ))}
                  {tareItems.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>
                        Empty tare
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="muted" style={{ padding: 8 }}>
                Select a tare to inspect items
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
