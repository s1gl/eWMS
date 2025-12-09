export type ZoneType = "inbound" | "storage" | "outbound";

export type Zone = {
  id: number;
  name: string;
  code: string;
  warehouse_id: number;
  zone_type: ZoneType;
};

export type ZoneCreate = {
  name: string;
  code: string;
  warehouse_id: number;
  zone_type: ZoneType;
};

export type ZoneUpdate = Partial<ZoneCreate>;
