import { request } from "./client";
import { Item, ItemCreate } from "../types";

export const fetchItems = (params: { query?: string; barcode?: string } = {}) => {
  const search = new URLSearchParams();
  if (params.query) search.append("query", params.query);
  if (params.barcode) search.append("barcode", params.barcode);
  const qs = search.toString();
  return request<Item[]>(`/items${qs ? `?${qs}` : ""}`);
};

export const createItem = (payload: ItemCreate) =>
  request<Item>("/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
