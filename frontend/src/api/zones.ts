import { request } from "./client";
import { Zone } from "../types";

export const fetchZones = () => request<Zone[]>("/zones");
