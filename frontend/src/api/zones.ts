import { request } from "./client";
import { Zone, ZoneCreate, ZoneUpdate } from "../types";

export const fetchZones = (warehouse_id?: number) => {
  const q = warehouse_id ? `?warehouse_id=${warehouse_id}` : "";
  return request<Zone[]>(`/zones${q}`);
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
