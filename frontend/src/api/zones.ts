import { request } from "./client";
import { Zone, ZoneCreate, ZoneUpdate } from "../types";

type Params = {
  warehouse_id?: number;
  zone_type?: string;
};

export const fetchZones = (params: Params | number = {}) => {
  const search = new URLSearchParams();
  if (typeof params === "number") {
    search.append("warehouse_id", String(params));
  } else {
    if (params.warehouse_id) search.append("warehouse_id", String(params.warehouse_id));
    if (params.zone_type) search.append("zone_type", params.zone_type);
  }
  const q = search.toString();
  return request<Zone[]>(`/zones${q ? `?${q}` : ""}`);
};

export const createZone = (payload: ZoneCreate) =>
  request<Zone>("/zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateZone = (id: number, payload: ZoneUpdate) =>
  request<Zone>(`/zones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteZone = (id: number) =>
  request<{ status: string }>(`/zones/${id}`, { method: "DELETE" });
