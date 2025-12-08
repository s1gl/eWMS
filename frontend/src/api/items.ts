import { request } from "./client";
import { Item, ItemCreate } from "../types";

export const fetchItems = () => request<Item[]>("/items");

export const createItem = (payload: ItemCreate) =>
  request<Item>("/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
