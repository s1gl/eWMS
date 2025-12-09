import { request } from "./client";
import { Tare, TareType } from "../types/tare";

type TareParams = {
  warehouse_id?: number;
  location_id?: number;
};

export const getTareTypes = () => request<TareType[]>("/tares/types");

export const getTares = (params: TareParams = {}) => {
  const search = new URLSearchParams();
  if (params.warehouse_id) search.append("warehouse_id", String(params.warehouse_id));
  if (params.location_id) search.append("location_id", String(params.location_id));
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
