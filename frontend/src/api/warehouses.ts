import { request } from "./client";
import { Warehouse, WarehouseCreate } from "../types";

export const fetchWarehouses = () => request<Warehouse[]>("/warehouses");

export const createWarehouse = (payload: WarehouseCreate) =>
  request<Warehouse>("/warehouses", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateWarehouse = (id: number, payload: Partial<WarehouseCreate> & { is_active?: boolean }) =>
  request<Warehouse>(`/warehouses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteWarehouse = (id: number) =>
  request<{ status: string }>(`/warehouses/${id}`, { method: "DELETE" });
