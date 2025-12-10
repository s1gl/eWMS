import { request } from "./client";
import { Tare, TareItemWithItem, TareStatus, TareType } from "../types/tare";

type TareParams = {
  warehouse_id?: number;
  location_id?: number;
  type_id?: number;
  status?: TareStatus;
  code?: string;
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
  if (params.code) search.append("code", params.code);
  const qs = search.toString();
  return request<Tare[]>(`/tares${qs ? `?${qs}` : ""}`);
};

export const getTare = (id: number) => request<Tare>(`/tares/${id}`);

export const getTareItems = (tareId: number) =>
  request<TareItemWithItem[]>(`/tares/${tareId}/items`);

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

export const getTaresForPutaway = (warehouse_id?: number) => {
  const params = new URLSearchParams();
  if (warehouse_id) params.append("warehouse_id", String(warehouse_id));
  const query = params.toString();
  return request<Tare[]>(`/tares/for-putaway${query ? `?${query}` : ""}`);
};

export const getTaresInStorage = (warehouse_id?: number) => {
  const params = new URLSearchParams();
  if (warehouse_id) params.append("warehouse_id", String(warehouse_id));
  const query = params.toString();
  return request<Tare[]>(`/tares/in-storage${query ? `?${query}` : ""}`);
};

export const putawayTare = (tareId: number, target_location_id: number) =>
  request<Tare>(`/tares/${tareId}/putaway`, {
    method: "POST",
    body: JSON.stringify({ target_location_id }),
  });

export const moveTare = (tareId: number, target_location_id: number) =>
  request<Tare>(`/tares/${tareId}/move`, {
    method: "POST",
    body: JSON.stringify({ target_location_id }),
  });
