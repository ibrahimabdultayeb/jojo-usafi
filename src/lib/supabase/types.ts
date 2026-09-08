/**
 * ============================================================================
 * TEMPORARY SCHEMA CONTRACT — NOT GENERATED, NOT RUNTIME-VERIFIED
 * ============================================================================
 *
 * These types are hand-authored from `supabase/migrations`. They have NEVER
 * been checked against a running PostgreSQL, because Build 05 had no database
 * to check against: Docker Desktop is unusable on this laptop (WSL returns
 * Wsl/CallMsi/E_ACCESSDENIED) and no hosted Supabase project has been created.
 *
 * They exist so that the client modules, the domain layer and future queries
 * are written against a real shape instead of `any`. They are a CONTRACT, not
 * evidence.
 *
 * BUILD 06 MUST REPLACE THIS FILE with the real thing:
 *
 *     npx supabase gen types typescript --project-id <dev project> > src/lib/supabase/types.ts
 *
 * and any difference between the generated output and what is written here is a
 * bug in this file, not in the database. Do not hand-edit it after that point.
 *
 * Column names, nullability and enum members below were transcribed from the
 * migrations by hand. `scripts/schema-check.mjs` compares the enum members and
 * the table list against the SQL on every run, so those two cannot drift
 * silently; individual column types are the part still awaiting generation.
 * ============================================================================
 */

/* -------------------------------------------------------------- enum types */

export type CatalogueLifecycle = "draft" | "active" | "hidden" | "archived";
export type MediaRoleValue = "primary" | "gallery" | "swatch" | "logo" | "icon";
export type InventoryMovementKindValue =
  | "receipt"
  | "stock_count"
  | "correction"
  | "reservation"
  | "reservation_release"
  | "sale"
  | "returned_delivery"
  | "damage_loss";
export type OrderStateValue =
  | "new"
  | "awaiting_confirmation"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "delivery_failed";
export type PaymentPreferenceValue = "cash_on_delivery" | "digital_on_delivery";
export type PaymentMethodValue = "cash" | "digital";
export type PaymentStatusValue = "unpaid" | "paid";
export type OrderEventKindValue =
  | "order_created"
  | "state_changed"
  | "confirmed"
  | "cancelled"
  | "delivery_failed"
  | "payment_recorded"
  | "stock_reserved"
  | "stock_released"
  | "order_amended"
  | "note_added"
  | "whatsapp_opened"
  | "staff_action";
export type ActorTypeValue = "customer" | "staff" | "system" | "sync";
export type AdminRoleValue = "owner" | "manager" | "order_staff";
export type SyncSourceValue = "sheet" | "admin" | "storefront" | "system";
export type SyncDirectionValue = "sheet_to_db" | "db_to_sheet";
export type SyncOperationValue = "insert" | "update" | "delete" | "upsert";
export type SyncStatusValue =
  | "pending"
  | "in_progress"
  | "applied"
  | "skipped_echo"
  | "conflict"
  | "failed";
export type SyncConflictResolutionValue = "pending" | "sheet_wins" | "db_wins" | "manual" | "ignored";
export type AnalyticsEventKindValue =
  | "page_view"
  | "product_impression"
  | "product_view"
  | "search"
  | "add_to_cart"
  | "remove_from_cart"
  | "checkout_started"
  | "order_created"
  | "whatsapp_initiated"
  | "order_confirmed"
  | "order_preparing"
  | "order_dispatched"
  | "order_completed"
  | "order_cancelled"
  | "order_delivery_failed";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/* ----------------------------------------------------------------- helpers */

/**
 * `Generated` names the columns PostgreSQL fills in itself — primary keys,
 * defaults, timestamps. They are optional on insert and never required on
 * update, which is exactly what the generated types express.
 */
type TableDef<Row, Generated extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Generated> & Partial<Pick<Row, Generated>>;
  Update: Partial<Row>;
  Relationships: [];
};

type ViewDef<Row> = { Row: Row; Relationships: [] };

/** Every table carries these two. */
interface Timestamps {
  created_at: string;
  updated_at: string;
}

type TimestampKeys = keyof Timestamps;

/* ------------------------------------------------------------------- rows */

export interface LocaleRow {
  code: string;
  label: string;
  english_label: string;
  is_default: boolean;
  active: boolean;
  sort_priority: number;
}

export interface PackTypeRow {
  code: string;
  label: string;
  sort_priority: number;
}

export interface SupplierRow extends Timestamps {
  id: string;
  code: string;
  name: string;
  country: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  active: boolean;
  notes: string | null;
}

export interface BrandRow extends Timestamps {
  id: string;
  code: string;
  slug: string;
  name: string;
  supplier_id: string | null;
  tagline: string | null;
  mark: string | null;
  tone: string | null;
  logo_media_id: string | null;
  active: boolean;
  sort_priority: number;
}

export interface CategoryRow extends Timestamps {
  id: string;
  code: string;
  slug: string;
  name: string;
  parent_id: string | null;
  blurb: string | null;
  icon_path: string | null;
  tone: string | null;
  active: boolean;
  sort_priority: number;
}

export interface MediaAssetRow extends Timestamps {
  id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  checksum: string | null;
  source_filename: string | null;
  alt_text: string | null;
}

export interface ProductFamilyRow extends Timestamps {
  id: string;
  code: string;
  slug: string;
  brand_id: string;
  category_id: string;
  supplier_id: string | null;
  name: string;
  summary: string | null;
  lifecycle: CatalogueLifecycle;
  sort_priority: number;
}

export interface ProductOptionAxisRow extends Timestamps {
  id: string;
  code: string;
  label: string;
  is_ordinal: boolean;
  sort_priority: number;
}

export interface ProductOptionValueRow extends Timestamps {
  id: string;
  axis_id: string;
  code: string;
  label: string;
  numeric_rank: number | null;
  sort_priority: number;
}

export interface ProductFamilyAxisRow {
  family_id: string;
  axis_id: string;
  position: number;
}

export interface ProductRow extends Timestamps {
  id: string;
  sku: string;
  slug: string;
  family_id: string;
  brand_id: string;
  category_id: string;
  supplier_id: string | null;
  ean: string | null;
  itf14: string | null;
  display_name: string;
  variant_label: string | null;
  pack_size_label: string | null;
  pack_type: string | null;
  size_rank: number | null;
  price_tzs: number;
  offer_price_tzs: number | null;
  lifecycle: CatalogueLifecycle;
  storefront_visible: boolean;
  low_stock_threshold: number;
  best_seller: boolean;
  featured: boolean;
  sort_priority: number;
}

export interface ProductOptionAssignmentRow {
  product_id: string;
  axis_id: string;
  value_id: string;
}

export interface ProductMediaRow extends Timestamps {
  id: string;
  product_id: string;
  media_id: string;
  role: MediaRoleValue;
  sort_priority: number;
}

export interface ProductContentRow extends Timestamps {
  product_id: string;
  locale: string;
  name: string;
  description: string | null;
  usage_notes: string | null;
}

export interface CategoryContentRow extends Timestamps {
  category_id: string;
  locale: string;
  name: string;
  blurb: string | null;
}

export interface InventoryRow extends Timestamps {
  product_id: string;
  location_code: string;
  on_hand: number;
  reserved: number;
  /** Generated column: on_hand - reserved. Read-only, never written. */
  available: number;
  last_counted_at: string | null;
}

export interface InventoryMovementRow {
  id: string;
  product_id: string;
  location_code: string;
  kind: InventoryMovementKindValue;
  on_hand_delta: number;
  reserved_delta: number;
  on_hand_after: number | null;
  reserved_after: number | null;
  order_id: string | null;
  reason: string | null;
  reference: string | null;
  actor_type: ActorTypeValue;
  actor_admin_id: string | null;
  actor_label: string | null;
  occurred_at: string;
  created_at: string;
}

export interface CustomerRow extends Timestamps {
  id: string;
  phone_e164: string;
  phone_display: string | null;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
  marketing_opt_in: boolean;
  notes: string | null;
  first_ordered_at: string | null;
  last_ordered_at: string | null;
}

export interface DeliveryZoneRow extends Timestamps {
  id: string;
  slug: string;
  name: string;
  fee_tzs: number;
  free_delivery: boolean;
  active: boolean;
  sort_priority: number;
  notes: string | null;
}

export interface CustomerAddressRow extends Timestamps {
  id: string;
  customer_id: string;
  delivery_zone_id: string | null;
  label: string | null;
  address_line: string;
  landmark: string | null;
  instructions: string | null;
  is_default: boolean;
  active: boolean;
}

export interface OrderRow extends Timestamps {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone_e164: string;
  customer_phone_display: string | null;
  customer_email: string | null;
  delivery_zone_id: string | null;
  delivery_zone_name: string;
  delivery_address: string;
  delivery_landmark: string | null;
  delivery_instructions: string | null;
  delivery_fee_tzs: number;
  subtotal_tzs: number;
  discount_tzs: number;
  total_tzs: number;
  payment_preference: PaymentPreferenceValue;
  payment_status: PaymentStatusValue;
  payment_method: PaymentMethodValue | null;
  payment_reference: string | null;
  paid_at: string | null;
  state: OrderStateValue;
  cancellation_reason: string | null;
  delivery_failure_reason: string | null;
  placed_at: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  failed_at: string | null;
  whatsapp_opened_at: string | null;
  channel: string;
  locale: string;
  customer_note: string | null;
  staff_note: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  product_name: string;
  variant_label: string | null;
  pack_size_label: string | null;
  brand_name: string | null;
  quantity: number;
  unit_price_tzs: number;
  line_total_tzs: number;
  position: number;
  created_at: string;
}

export interface OrderEventRow {
  id: string;
  order_id: string;
  kind: OrderEventKindValue;
  from_state: OrderStateValue | null;
  to_state: OrderStateValue | null;
  actor_type: ActorTypeValue;
  actor_admin_id: string | null;
  actor_label: string | null;
  summary: string | null;
  payload: Json;
  occurred_at: string;
  created_at: string;
}

export interface AdminProfileRow extends Timestamps {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  role: AdminRoleValue;
  active: boolean;
  invited_at: string | null;
  last_seen_at: string | null;
}

export interface AuditEventRow {
  id: string;
  action: string;
  entity_table: string;
  entity_id: string | null;
  entity_key: string | null;
  actor_type: ActorTypeValue;
  actor_admin_id: string | null;
  actor_label: string | null;
  source: SyncSourceValue;
  before_data: Json | null;
  after_data: Json | null;
  changed_fields: string[] | null;
  request_id: string | null;
  user_agent: string | null;
  occurred_at: string;
  created_at: string;
}

export interface SyncJobRow extends Timestamps {
  id: string;
  direction: SyncDirectionValue;
  source: SyncSourceValue;
  entity_table: string;
  status: SyncStatusValue;
  idempotency_key: string;
  requested_by: string | null;
  rows_seen: number;
  rows_applied: number;
  rows_skipped: number;
  rows_failed: number;
  retry_count: number;
  next_retry_at: string | null;
  error_message: string | null;
  error_detail: Json | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface SyncEventRow extends Timestamps {
  id: string;
  job_id: string | null;
  source: SyncSourceValue;
  direction: SyncDirectionValue;
  operation: SyncOperationValue;
  entity_table: string;
  entity_id: string | null;
  entity_key: string;
  field_changes: Json;
  fingerprint: string;
  base_fingerprint: string | null;
  status: SyncStatusValue;
  idempotency_key: string;
  retry_count: number;
  next_retry_at: string | null;
  error_message: string | null;
  sheet_tab: string | null;
  sheet_row: number | null;
  applied_at: string | null;
}

export interface SyncStateRow extends Timestamps {
  entity_table: string;
  entity_key: string;
  entity_id: string | null;
  version: number;
  db_fingerprint: string | null;
  sheet_fingerprint: string | null;
  last_source: SyncSourceValue | null;
  last_synced_at: string | null;
  last_reconciled_at: string | null;
  sheet_tab: string | null;
  sheet_row: number | null;
}

export interface SyncConflictRow extends Timestamps {
  id: string;
  sync_event_id: string | null;
  entity_table: string;
  entity_key: string;
  field: string;
  sheet_value: Json | null;
  db_value: Json | null;
  resolution: SyncConflictResolutionValue;
  resolved_by: string | null;
  resolved_at: string | null;
  note: string | null;
  detected_at: string;
}

export interface AnalyticsEventRow {
  id: string;
  kind: AnalyticsEventKindValue;
  occurred_at: string;
  session_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  sku: string | null;
  entity_table: string | null;
  entity_key: string | null;
  locale: string | null;
  path: string | null;
  referrer: string | null;
  properties: Json;
  created_at: string;
}

/* ------------------------------------------------------------------- views */

export interface ProductShelfRow {
  id: string;
  sku: string;
  slug: string;
  display_name: string;
  variant_label: string | null;
  pack_size_label: string | null;
  pack_type: string | null;
  size_rank: number | null;
  price_tzs: number;
  offer_price_tzs: number | null;
  effective_price_tzs: number;
  best_seller: boolean;
  featured: boolean;
  sort_priority: number;
  family_id: string;
  family_slug: string;
  family_name: string;
  brand_id: string;
  brand_slug: string;
  brand_name: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  image_bucket: string;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  image_alt: string | null;
  available: number;
  in_stock: boolean;
  low_stock: boolean;
}

export interface InventoryLedgerCheckRow {
  product_id: string;
  location_code: string;
  on_hand: number;
  reserved: number;
  ledger_on_hand: number;
  ledger_reserved: number;
  matches: boolean;
}

/* ---------------------------------------------------------------- Database */

export interface Database {
  public: {
    Tables: {
      locales: TableDef<LocaleRow, "is_default" | "active" | "sort_priority">;
      pack_types: TableDef<PackTypeRow, "sort_priority">;
      suppliers: TableDef<SupplierRow, "id" | "active" | TimestampKeys>;
      brands: TableDef<BrandRow, "id" | "active" | "sort_priority" | TimestampKeys>;
      categories: TableDef<CategoryRow, "id" | "active" | "sort_priority" | TimestampKeys>;
      media_assets: TableDef<MediaAssetRow, "id" | "storage_bucket" | "mime_type" | TimestampKeys>;
      product_families: TableDef<ProductFamilyRow, "id" | "lifecycle" | "sort_priority" | TimestampKeys>;
      product_option_axes: TableDef<ProductOptionAxisRow, "id" | "is_ordinal" | "sort_priority" | TimestampKeys>;
      product_option_values: TableDef<ProductOptionValueRow, "id" | "sort_priority" | TimestampKeys>;
      product_family_axes: TableDef<ProductFamilyAxisRow, "position">;
      products: TableDef<
        ProductRow,
        | "id"
        | "lifecycle"
        | "storefront_visible"
        | "low_stock_threshold"
        | "best_seller"
        | "featured"
        | "sort_priority"
        | TimestampKeys
      >;
      product_option_assignments: TableDef<ProductOptionAssignmentRow>;
      product_media: TableDef<ProductMediaRow, "id" | "role" | "sort_priority" | TimestampKeys>;
      product_content: TableDef<ProductContentRow, TimestampKeys>;
      category_content: TableDef<CategoryContentRow, TimestampKeys>;

      inventory: TableDef<
        InventoryRow,
        "location_code" | "on_hand" | "reserved" | "available" | TimestampKeys
      >;
      inventory_movements: TableDef<
        InventoryMovementRow,
        "id" | "location_code" | "on_hand_delta" | "reserved_delta" | "actor_type" | "occurred_at" | "created_at"
      >;

      customers: TableDef<CustomerRow, "id" | "marketing_opt_in" | TimestampKeys>;
      delivery_zones: TableDef<
        DeliveryZoneRow,
        "id" | "fee_tzs" | "free_delivery" | "active" | "sort_priority" | TimestampKeys
      >;
      customer_addresses: TableDef<CustomerAddressRow, "id" | "is_default" | "active" | TimestampKeys>;

      orders: TableDef<
        OrderRow,
        | "id"
        | "order_number"
        | "discount_tzs"
        | "payment_status"
        | "state"
        | "placed_at"
        | "channel"
        | "locale"
        | TimestampKeys
      >;
      order_items: TableDef<OrderItemRow, "id" | "position" | "created_at">;
      order_events: TableDef<OrderEventRow, "id" | "actor_type" | "payload" | "occurred_at" | "created_at">;

      admin_profiles: TableDef<AdminProfileRow, "id" | "role" | "active" | TimestampKeys>;
      audit_events: TableDef<AuditEventRow, "id" | "actor_type" | "source" | "occurred_at" | "created_at">;

      sync_jobs: TableDef<
        SyncJobRow,
        | "id"
        | "status"
        | "rows_seen"
        | "rows_applied"
        | "rows_skipped"
        | "rows_failed"
        | "retry_count"
        | TimestampKeys
      >;
      sync_events: TableDef<
        SyncEventRow,
        "id" | "field_changes" | "base_fingerprint" | "status" | "retry_count" | TimestampKeys
      >;
      sync_state: TableDef<SyncStateRow, "version" | TimestampKeys>;
      sync_conflicts: TableDef<SyncConflictRow, "id" | "resolution" | "detected_at" | TimestampKeys>;

      analytics_events: TableDef<
        AnalyticsEventRow,
        "id" | "occurred_at" | "properties" | "created_at"
      >;
    };
    Views: {
      product_shelf: ViewDef<ProductShelfRow>;
      inventory_ledger_check: ViewDef<InventoryLedgerCheckRow>;
    };
    Functions: {
      next_order_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      catalogue_lifecycle: CatalogueLifecycle;
      media_role: MediaRoleValue;
      inventory_movement_kind: InventoryMovementKindValue;
      order_state: OrderStateValue;
      payment_preference: PaymentPreferenceValue;
      payment_method: PaymentMethodValue;
      payment_status: PaymentStatusValue;
      order_event_kind: OrderEventKindValue;
      actor_type: ActorTypeValue;
      admin_role: AdminRoleValue;
      sync_source: SyncSourceValue;
      sync_direction: SyncDirectionValue;
      sync_operation: SyncOperationValue;
      sync_status: SyncStatusValue;
      sync_conflict_resolution: SyncConflictResolutionValue;
      analytics_event_kind: AnalyticsEventKindValue;
    };
    CompositeTypes: Record<string, never>;
  };
}

/** `Tables<"orders">` reads better than the full path at every call site. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
