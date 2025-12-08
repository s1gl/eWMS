import { request } from "./client";
import { Zone, ZoneCreate } from "../types";

export const fetchZones = () => request<Zone[]>("/zones");

export const createZone = (payload: ZoneCreate) =>
  request<Zone>("/zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
