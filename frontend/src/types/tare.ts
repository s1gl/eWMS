export type TareStatus = "inbound" | "storage" | "picking" | "outbound" | "closed";

export type TareType = {
  id: number;
  code: string;
  name: string;
  prefix: string;
  level: number;
};

export type Tare = {
  id: number;
  warehouse_id: number;
  type_id: number;
  location_id: number | null;
  parent_tare_id: number | null;
  tare_code: string;
  status: TareStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TareItemWithItem = {
  id: number;
  tare_id: number;
  item_id: number;
  quantity: number;
  item_sku: string;
  item_name: string;
  item_unit: string;
};
