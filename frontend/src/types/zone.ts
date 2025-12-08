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

export type ZoneUpdate = Partial<ZoneCreate>;
