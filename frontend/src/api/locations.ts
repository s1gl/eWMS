import { request } from "./client";
import { Location, LocationCreate } from "../types";

type Params = {
  warehouse_id?: number;
  zone_id?: number;
};

export const fetchLocations = (params: Params = {}) => {
  const search = new URLSearchParams();
  if (params.warehouse_id) search.append("warehouse_id", String(params.warehouse_id));
  if (params.zone_id) search.append("zone_id", String(params.zone_id));
  const query = search.toString();
  return request<Location[]>(`/locations${query ? `?${query}` : ""}`);
};

export const createLocation = (payload: LocationCreate) =>
  request<Location>("/locations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
