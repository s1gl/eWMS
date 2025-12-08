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

export type WarehouseUpdate = Partial<WarehouseCreate> & {
  is_active?: boolean;
};
