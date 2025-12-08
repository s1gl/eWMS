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

export type LocationUpdate = Partial<LocationCreate> & {
  is_active?: boolean;
};
