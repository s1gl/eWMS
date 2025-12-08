export type InboundStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "problem"
  | "mis_sort";

export type InboundOrderLine = {
  id: number;
  inbound_order_id: number;
  item_id: number;
  expected_qty: number;
  received_qty: number;
  location_id: number | null;
  line_status: string | null;
};

export type InboundOrder = {
  id: number;
  external_number: string;
  warehouse_id: number;
  partner_id?: number | null;
  status: InboundStatus;
  created_at?: string | null;
  updated_at?: string | null;
  lines: InboundOrderLine[];
};

export type InboundOrderLineCreate = {
  item_id: number;
  expected_qty: number;
  location_id?: number | null;
};

export type InboundOrderCreate = {
  external_number: string;
  warehouse_id: number;
  partner_id?: number | null;
  lines: InboundOrderLineCreate[];
};

export type InboundStatusUpdate = {
  status: InboundStatus;
};

export type InboundReceivePayload = {
  line_id: number;
  location_id: number;
  qty: number;
  item_id?: number;
  condition?: string;
};
