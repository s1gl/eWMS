import { request } from "./client";
import { Warehouse, WarehouseCreate } from "../types";

export const fetchWarehouses = () => request<Warehouse[]>("/warehouses");

export const createWarehouse = (payload: WarehouseCreate) =>
  request<Warehouse>("/warehouses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
