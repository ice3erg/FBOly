// Общие типы данных API FBOly. Перенесены без изменений из прежнего
// монолитного frontend/app/page.tsx — их использует и Поставка, и Слоты.

export type WarehousePercentage = {
  name: string;
  percentage: number;
  cluster_ids?: string[];
  classic_cluster_ids?: string[];
  warehouse_ids?: string[];
};

export type WarehouseFile = {
  warehouse: string;
  filename: string;
  content_base64?: string;
  rows_count: number;
  total_quantity: number;
};

export type ProcessingError = {
  row_number: number;
  message: string;
  input: Record<string, string | number | null>;
  diagnostics?: string[];
};

export type ResolvedItem = {
  row_number: number;
  offer_id: string;
  name: string | null;
  quantity: number;
  source: string;
  sku: string | null;
};

export type DraftCandidate = {
  warehouse: string;
  rows_count: number;
  total_quantity: number;
  can_create?: boolean;
  reason?: string;
  operation_id?: string | null;
  draft_id?: string | null;
  draft_status?: string | null;
  cluster_ids?: string[];
  warehouse_ids?: string[];
  selected_cluster_warehouses?: Array<{
    cluster_id?: number | string;
    macrolocal_cluster_id?: number | string;
    storage_warehouse_id?: number | string;
    warehouse_id?: number | string;
    source?: string;
  }>;
  selected_cluster_warehouses_source?: string;
  supply_type?: number | string;
  supply_mode?: "direct" | "crossdock" | string | null;
  drop_off_point_warehouse_id?: string | number | null;
  drop_off_point_warehouse_type?: string | number | null;
  draft_flow?: string | null;
  items?: Array<{ sku: string; offer_id: string; name: string; quantity: number }>;
};

export type DraftCreationResult = {
  ok: boolean;
  warehouse: string;
  operation_id?: string | null;
  draft_id?: string | null;
  status?: string | null;
  items_count?: number | null;
  total_quantity?: number | null;
  error?: string;
  http_status?: number | null;
  endpoint?: string | null;
  ozon_response?: string | null;
  retry_after_ms?: number | null;
  is_rate_limited?: boolean | null;
  attempts_count?: number | null;
  classic_cluster_ids?: string[] | number[] | null;
  cluster_ids?: string[] | number[] | null;
  warehouse_ids?: string[] | number[] | null;
  selected_cluster_warehouses?: DraftCandidate["selected_cluster_warehouses"];
  selected_cluster_warehouses_source?: string | null;
  supply_type?: number | string | null;
  supply_mode?: string | null;
  drop_off_point_warehouse_id?: string | number | null;
  drop_off_point_warehouse_type?: string | number | null;
  draft_flow?: string | null;
};

export type DraftStatus = {
  type: "idle" | "success" | "error";
  message: string;
  results: DraftCreationResult[];
};

export type CrossdockPoint = {
  id: string;
  name: string;
  address?: string;
  warehouse_type?: string;
  limits?: string[];
};

export type DraftCreationJob = {
  id: string;
  status: string;
  next_attempt_at?: string | null;
  last_message?: string | null;
  results?: DraftCreationResult[];
  targets?: Array<{
    warehouse: string;
    status: string;
    attempts_count: number;
    next_attempt_at?: string | null;
    last_message?: string | null;
    error_message?: string | null;
    result?: DraftCreationResult | null;
  }>;
  summary?: { total: number; created: number; waiting: number; failed: number };
};

export type SlotHunterTarget = {
  id: string;
  warehouse: string;
  status: string;
  priority: number;
  is_priority?: boolean;
  rows_count: number;
  total_quantity: number;
  attempts_count: number;
  last_attempt_at?: string | null;
  next_attempt_at?: string | null;
  operation_id?: string | null;
  draft_id?: string | null;
  supply_operation_id?: string | null;
  supply_order_id?: string | null;
  selected_slot?: unknown;
  last_message?: string | null;
  error_message?: string | null;
};

export type SlotHunterAttempt = {
  id: string;
  target_id?: string | null;
  warehouse?: string | null;
  attempt_type: string;
  status: string;
  message: string;
  http_status?: number | null;
  raw_response?: unknown;
  attempted_at: string;
};

export type SlotHunterJob = {
  id: string;
  status: string;
  mode: "auto_book" | "notify_only";
  auto_book: boolean;
  interval_seconds: number;
  concurrency_limit: number;
  max_wait_until: string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  next_attempt_at?: string | null;
  rate_limited_until?: string | null;
  draft_phase_until?: string | null;
  last_message?: string | null;
  summary: {
    targets: number;
    booked: number;
    found: number;
    searching: number;
    failed: number;
    skipped: number;
    with_draft?: number;
    priority?: number;
    total_quantity: number;
  };
  targets: SlotHunterTarget[];
  attempts: SlotHunterAttempt[];
};

export type ProcessResponse = {
  files: WarehouseFile[];
  errors: ProcessingError[];
  resolved_items: ResolvedItem[];
  total_input_quantity: number;
  total_output_quantity: number;
  api_credentials_configured?: boolean;
  archive_base64?: string;
  distribution_mode?: string;
  distribution_note?: string;
  draft_candidates?: DraftCandidate[];
};
