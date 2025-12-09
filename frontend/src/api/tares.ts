import { request } from "./client";
import { Tare, TareStatus, TareType } from "../types/tare";

type TareParams = {
  warehouse_id?: number;
  location_id?: number;
  type_id?: number;
  status?: TareStatus;
};

export const getTareTypes = () => request<TareType[]>("/tares/types");
export const createTareType = (payload: Omit<TareType, "id">) =>
  request<TareType>("/tares/types", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateTareType = (id: number, payload: Partial<Omit<TareType, "id">>) =>
  request<TareType>(`/tares/types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const deleteTareType = (id: number) =>
  request<void>(`/tares/types/${id}`, { method: "DELETE", skipJson: true });

export const getTares = (params: TareParams = {}) => {
  const search = new URLSearchParams();
  if (params.warehouse_id) search.append("warehouse_id", String(params.warehouse_id));
  if (params.location_id) search.append("location_id", String(params.location_id));
  if (params.type_id) search.append("type_id", String(params.type_id));
  if (params.status) search.append("status_filter", params.status);
  const qs = search.toString();
  return request<Tare[]>(`/tares${qs ? `?${qs}` : ""}`);
};

export const createTare = (payload: {
  warehouse_id: number;
  type_id: number;
  location_id?: number | null;
  parent_tare_id?: number | null;
}) =>
  request<Tare>("/tares", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createTaresBulk = (payload: {
  warehouse_id: number;
  type_id: number;
  count: number;
  location_id?: number | null;
  parent_tare_id?: number | null;
}) =>
  request<Tare[]>("/tares/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
