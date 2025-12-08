import { request } from "./client";
import { Zone, ZoneCreate } from "../types";

export const fetchZones = () => request<Zone[]>("/zones");

export const createZone = (payload: ZoneCreate) =>
  request<Zone>("/zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateZone = (id: number, payload: Partial<ZoneCreate>) =>
  request<Zone>(`/zones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteZone = (id: number) =>
  request<{ status: string }>(`/zones/${id}`, { method: "DELETE" });
