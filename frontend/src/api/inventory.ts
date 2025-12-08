import { request } from "./client";
import { InventoryRecord, InboundPayload, MovePayload } from "../types";

type InventoryFilters = {
  warehouse_id?: number;
  location_id?: number;
  item_id?: number;
};

export const fetchInventory = (filters: InventoryFilters = {}) => {
  const search = new URLSearchParams();
  if (filters.warehouse_id) search.append("warehouse_id", String(filters.warehouse_id));
  if (filters.location_id) search.append("location_id", String(filters.location_id));
  if (filters.item_id) search.append("item_id", String(filters.item_id));
  const query = search.toString();
  return request<InventoryRecord[]>(`/inventory${query ? `?${query}` : ""}`);
};

export const createInbound = (payload: InboundPayload) =>
  request<InventoryRecord>("/inventory/inbound", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const moveInventory = (payload: MovePayload) =>
  request<{ status: string }>("/inventory/move", {
    method: "POST",
    body: JSON.stringify(payload),
  });
