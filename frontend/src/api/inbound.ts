import { request } from "./client";
import {
  InboundOrder,
  InboundOrderCreate,
  InboundReceivePayload,
  InboundStatusUpdate,
} from "../types/inbound";

export const getInboundOrders = (params: {
  warehouse_id?: number;
  status?: string;
  external_number?: string;
} = {}) => {
  const search = new URLSearchParams();
  if (params.warehouse_id) search.append("warehouse_id", String(params.warehouse_id));
  if (params.status) search.append("status_filter", params.status);
  if (params.external_number) search.append("external_number", params.external_number);
  const qs = search.toString();
  return request<InboundOrder[]>(`/inbound_orders${qs ? `?${qs}` : ""}`);
};

export const getInboundOrder = (id: number) =>
  request<InboundOrder>(`/inbound_orders/${id}`);

export const createInboundOrder = (payload: InboundOrderCreate) =>
  request<InboundOrder>("/inbound_orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const changeInboundStatus = (id: number, payload: InboundStatusUpdate) =>
  request<InboundOrder>(`/inbound_orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const receiveInboundLine = (id: number, payload: InboundReceivePayload) =>
  request<InboundOrder>(`/inbound_orders/${id}/receive`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
