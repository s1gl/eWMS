export type Warehouse = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
};

export type WarehouseCreate = {
  name: string;
  code: string;
};

export type Zone = {
  id: number;
  name: string;
  code: string;
  warehouse_id: number;
};

export type ZoneCreate = {
  name: string;
  code: string;
  warehouse_id: number;
};

export type Location = {
  id: number;
  warehouse_id: number;
  zone_id?: number | null;
  code: string;
  description?: string | null;
  is_active: boolean;
};

export type LocationCreate = {
  warehouse_id: number;
  code: string;
  zone_id?: number | null;
  description?: string | null;
};

export type Item = {
  id: number;
  sku: string;
  name: string;
  barcode?: string | null;
  unit: string;
  is_active: boolean;
};

export type ItemCreate = {
  sku: string;
  name: string;
  barcode?: string | null;
  unit?: string;
};

export type InventoryRecord = {
  id: number;
  warehouse_id: number;
  location_id: number;
  item_id: number;
  quantity: number;
};

export type InboundPayload = {
  warehouse_id: number;
  location_id: number;
  item_id: number;
  qty: number;
};

export type MovePayload = {
  warehouse_id: number;
  from_location_id: number;
  to_location_id: number;
  item_id: number;
  qty: number;
};

export type ApiError = {
  detail?: string;
};
