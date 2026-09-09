/**
 * ============================================================================
 * GENERATED FROM THE REAL DATABASE — DO NOT EDIT BY HAND
 * ============================================================================
 *
 * Produced by `npm run db:types`, which runs
 *
 *     supabase gen types typescript --project-id dyjhacbbedytcstxxjzl --schema public
 *
 * against the hosted Jojo Usafi development project. Every type below was read
 * out of PostgreSQL's own catalogue after the migrations in supabase/migrations
 * were applied to it, so a column here exists, is spelled this way and is
 * nullable exactly this much.
 *
 * Hand edits are lost on the next generation, and `npm run db:types:check`
 * fails the database gate if this file and the database have drifted apart.
 *
 * The friendly aliases the application imports — `ProductRow`, `OrderRow`,
 * `AdminRoleValue` and the rest — are derived from this file in `./types.ts`,
 * so they cannot describe a column that is not really there.
 * ============================================================================
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          invited_at: string | null
          last_seen_at: string | null
          phone_e164: string | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          invited_at?: string | null
          last_seen_at?: string | null
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          invited_at?: string | null
          last_seen_at?: string | null
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          customer_id: string | null
          entity_key: string | null
          entity_table: string | null
          id: string
          kind: Database["public"]["Enums"]["analytics_event_kind"]
          locale: string | null
          occurred_at: string
          order_id: string | null
          path: string | null
          properties: Json
          referrer: string | null
          session_id: string | null
          sku: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          entity_key?: string | null
          entity_table?: string | null
          id?: string
          kind: Database["public"]["Enums"]["analytics_event_kind"]
          locale?: string | null
          occurred_at?: string
          order_id?: string | null
          path?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          sku?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          entity_key?: string | null
          entity_table?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["analytics_event_kind"]
          locale?: string | null
          occurred_at?: string
          order_id?: string | null
          path?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_locale_fkey"
            columns: ["locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "analytics_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_admin_id: string | null
          actor_label: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          after_data: Json | null
          before_data: Json | null
          changed_fields: string[] | null
          created_at: string
          entity_id: string | null
          entity_key: string | null
          entity_table: string
          id: string
          occurred_at: string
          request_id: string | null
          source: Database["public"]["Enums"]["sync_source"]
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_admin_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_key?: string | null
          entity_table: string
          id?: string
          occurred_at?: string
          request_id?: string | null
          source?: Database["public"]["Enums"]["sync_source"]
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_admin_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_key?: string | null
          entity_table?: string
          id?: string
          occurred_at?: string
          request_id?: string | null
          source?: Database["public"]["Enums"]["sync_source"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_admin_id_fkey"
            columns: ["actor_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          logo_media_id: string | null
          mark: string | null
          name: string
          slug: string
          sort_priority: number
          supplier_id: string | null
          tagline: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          logo_media_id?: string | null
          mark?: string | null
          name: string
          slug: string
          sort_priority?: number
          supplier_id?: string | null
          tagline?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          logo_media_id?: string | null
          mark?: string | null
          name?: string
          slug?: string
          sort_priority?: number
          supplier_id?: string | null
          tagline?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_logo_media_fk"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          blurb: string | null
          code: string
          created_at: string
          icon_path: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_priority: number
          tone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          blurb?: string | null
          code: string
          created_at?: string
          icon_path?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_priority?: number
          tone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          blurb?: string | null
          code?: string
          created_at?: string
          icon_path?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_priority?: number
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_content: {
        Row: {
          blurb: string | null
          category_id: string
          created_at: string
          locale: string
          name: string
          updated_at: string
        }
        Insert: {
          blurb?: string | null
          category_id: string
          created_at?: string
          locale: string
          name: string
          updated_at?: string
        }
        Update: {
          blurb?: string | null
          category_id?: string
          created_at?: string
          locale?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_content_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_content_locale_fkey"
            columns: ["locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          active: boolean
          address_line: string
          created_at: string
          customer_id: string
          delivery_zone_id: string | null
          id: string
          instructions: string | null
          is_default: boolean
          label: string | null
          landmark: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_line: string
          created_at?: string
          customer_id: string
          delivery_zone_id?: string | null
          id?: string
          instructions?: string | null
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_line?: string
          created_at?: string
          customer_id?: string
          delivery_zone_id?: string | null
          id?: string
          instructions?: string | null
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          first_ordered_at: string | null
          full_name: string
          id: string
          last_ordered_at: string | null
          marketing_opt_in: boolean
          notes: string | null
          phone_display: string | null
          phone_e164: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          first_ordered_at?: string | null
          full_name: string
          id?: string
          last_ordered_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone_display?: string | null
          phone_e164: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          first_ordered_at?: string | null
          full_name?: string
          id?: string
          last_ordered_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone_display?: string | null
          phone_e164?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          active: boolean
          created_at: string
          fee_tzs: number
          free_delivery: boolean
          id: string
          name: string
          notes: string | null
          slug: string
          sort_priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fee_tzs?: number
          free_delivery?: boolean
          id?: string
          name: string
          notes?: string | null
          slug: string
          sort_priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fee_tzs?: number
          free_delivery?: boolean
          id?: string
          name?: string
          notes?: string | null
          slug?: string
          sort_priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          available: number | null
          created_at: string
          last_counted_at: string | null
          location_code: string
          on_hand: number
          product_id: string
          reserved: number
          updated_at: string
        }
        Insert: {
          available?: number | null
          created_at?: string
          last_counted_at?: string | null
          location_code?: string
          on_hand?: number
          product_id: string
          reserved?: number
          updated_at?: string
        }
        Update: {
          available?: number | null
          created_at?: string
          last_counted_at?: string | null
          location_code?: string
          on_hand?: number
          product_id?: string
          reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_shelf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_admin_id: string | null
          actor_label: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["inventory_movement_kind"]
          location_code: string
          occurred_at: string
          on_hand_after: number | null
          on_hand_delta: number
          order_id: string | null
          product_id: string
          reason: string | null
          reference: string | null
          reserved_after: number | null
          reserved_delta: number
        }
        Insert: {
          actor_admin_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["inventory_movement_kind"]
          location_code?: string
          occurred_at?: string
          on_hand_after?: number | null
          on_hand_delta?: number
          order_id?: string | null
          product_id: string
          reason?: string | null
          reference?: string | null
          reserved_after?: number | null
          reserved_delta?: number
        }
        Update: {
          actor_admin_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["inventory_movement_kind"]
          location_code?: string
          occurred_at?: string
          on_hand_after?: number | null
          on_hand_delta?: number
          order_id?: string | null
          product_id?: string
          reason?: string | null
          reference?: string | null
          reserved_after?: number | null
          reserved_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_fk"
            columns: ["actor_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_shelf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_location_code_fkey"
            columns: ["product_id", "location_code"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["product_id", "location_code"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_location_code_fkey"
            columns: ["product_id", "location_code"]
            isOneToOne: false
            referencedRelation: "inventory_ledger_check"
            referencedColumns: ["product_id", "location_code"]
          },
        ]
      }
      locales: {
        Row: {
          active: boolean
          code: string
          english_label: string
          is_default: boolean
          label: string
          sort_priority: number
        }
        Insert: {
          active?: boolean
          code: string
          english_label: string
          is_default?: boolean
          label: string
          sort_priority?: number
        }
        Update: {
          active?: boolean
          code?: string
          english_label?: string
          is_default?: boolean
          label?: string
          sort_priority?: number
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt_text: string | null
          byte_size: number | null
          checksum: string | null
          created_at: string
          height: number | null
          id: string
          mime_type: string
          source_filename: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          byte_size?: number | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          source_filename?: string | null
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          byte_size?: number | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          source_filename?: string | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      order_events: {
        Row: {
          actor_admin_id: string | null
          actor_label: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at: string
          from_state: Database["public"]["Enums"]["order_state"] | null
          id: string
          kind: Database["public"]["Enums"]["order_event_kind"]
          occurred_at: string
          order_id: string
          payload: Json
          summary: string | null
          to_state: Database["public"]["Enums"]["order_state"] | null
        }
        Insert: {
          actor_admin_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          from_state?: Database["public"]["Enums"]["order_state"] | null
          id?: string
          kind: Database["public"]["Enums"]["order_event_kind"]
          occurred_at?: string
          order_id: string
          payload?: Json
          summary?: string | null
          to_state?: Database["public"]["Enums"]["order_state"] | null
        }
        Update: {
          actor_admin_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          from_state?: Database["public"]["Enums"]["order_state"] | null
          id?: string
          kind?: Database["public"]["Enums"]["order_event_kind"]
          occurred_at?: string
          order_id?: string
          payload?: Json
          summary?: string | null
          to_state?: Database["public"]["Enums"]["order_state"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_fk"
            columns: ["actor_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          brand_name: string | null
          created_at: string
          id: string
          line_total_tzs: number
          order_id: string
          pack_size_label: string | null
          position: number
          product_id: string | null
          product_name: string
          quantity: number
          sku: string
          unit_price_tzs: number
          variant_label: string | null
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          id?: string
          line_total_tzs: number
          order_id: string
          pack_size_label?: string | null
          position?: number
          product_id?: string | null
          product_name: string
          quantity: number
          sku: string
          unit_price_tzs: number
          variant_label?: string | null
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          id?: string
          line_total_tzs?: number
          order_id?: string
          pack_size_label?: string | null
          position?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string
          unit_price_tzs?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_shelf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          channel: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_note: string | null
          customer_phone_display: string | null
          customer_phone_e164: string
          delivery_address: string
          delivery_failure_reason: string | null
          delivery_fee_tzs: number
          delivery_instructions: string | null
          delivery_landmark: string | null
          delivery_zone_id: string | null
          delivery_zone_name: string
          discount_tzs: number
          dispatched_at: string | null
          failed_at: string | null
          id: string
          locale: string
          order_number: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_preference: Database["public"]["Enums"]["payment_preference"]
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string
          preparing_at: string | null
          reservation_expires_at: string | null
          reservation_released_at: string | null
          staff_note: string | null
          state: Database["public"]["Enums"]["order_state"]
          subtotal_tzs: number
          total_tzs: number
          updated_at: string
          whatsapp_opened_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_note?: string | null
          customer_phone_display?: string | null
          customer_phone_e164: string
          delivery_address: string
          delivery_failure_reason?: string | null
          delivery_fee_tzs: number
          delivery_instructions?: string | null
          delivery_landmark?: string | null
          delivery_zone_id?: string | null
          delivery_zone_name: string
          discount_tzs?: number
          dispatched_at?: string | null
          failed_at?: string | null
          id?: string
          locale?: string
          order_number?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_preference: Database["public"]["Enums"]["payment_preference"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          preparing_at?: string | null
          reservation_expires_at?: string | null
          reservation_released_at?: string | null
          staff_note?: string | null
          state?: Database["public"]["Enums"]["order_state"]
          subtotal_tzs: number
          total_tzs: number
          updated_at?: string
          whatsapp_opened_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_note?: string | null
          customer_phone_display?: string | null
          customer_phone_e164?: string
          delivery_address?: string
          delivery_failure_reason?: string | null
          delivery_fee_tzs?: number
          delivery_instructions?: string | null
          delivery_landmark?: string | null
          delivery_zone_id?: string | null
          delivery_zone_name?: string
          discount_tzs?: number
          dispatched_at?: string | null
          failed_at?: string | null
          id?: string
          locale?: string
          order_number?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_preference?: Database["public"]["Enums"]["payment_preference"]
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          preparing_at?: string | null
          reservation_expires_at?: string | null
          reservation_released_at?: string | null
          staff_note?: string | null
          state?: Database["public"]["Enums"]["order_state"]
          subtotal_tzs?: number
          total_tzs?: number
          updated_at?: string
          whatsapp_opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_locale_fkey"
            columns: ["locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
        ]
      }
      pack_types: {
        Row: {
          code: string
          label: string
          sort_priority: number
        }
        Insert: {
          code: string
          label: string
          sort_priority?: number
        }
        Update: {
          code?: string
          label?: string
          sort_priority?: number
        }
        Relationships: []
      }
      product_content: {
        Row: {
          created_at: string
          description: string | null
          locale: string
          name: string
          product_id: string
          updated_at: string
          usage_notes: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          locale: string
          name: string
          product_id: string
          updated_at?: string
          usage_notes?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          locale?: string
          name?: string
          product_id?: string
          updated_at?: string
          usage_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_content_locale_fkey"
            columns: ["locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "product_content_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_shelf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_content_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_families: {
        Row: {
          brand_id: string
          category_id: string
          code: string
          created_at: string
          id: string
          lifecycle: Database["public"]["Enums"]["catalogue_lifecycle"]
          name: string
          slug: string
          sort_priority: number
          summary: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          category_id: string
          code: string
          created_at?: string
          id?: string
          lifecycle?: Database["public"]["Enums"]["catalogue_lifecycle"]
          name: string
          slug: string
          sort_priority?: number
          summary?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category_id?: string
          code?: string
          created_at?: string
          id?: string
          lifecycle?: Database["public"]["Enums"]["catalogue_lifecycle"]
          name?: string
          slug?: string
          sort_priority?: number
          summary?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_families_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_families_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_families_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_family_axes: {
        Row: {
          axis_id: string
          family_id: string
          position: number
        }
        Insert: {
          axis_id: string
          family_id: string
          position?: number
        }
        Update: {
          axis_id?: string
          family_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_family_axes_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "product_option_axes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_family_axes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          media_id: string
          product_id: string
          role: Database["public"]["Enums"]["media_role"]
          sort_priority: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          product_id: string
          role?: Database["public"]["Enums"]["media_role"]
          sort_priority?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          product_id?: string
          role?: Database["public"]["Enums"]["media_role"]
          sort_priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_shelf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_assignments: {
        Row: {
          axis_id: string
          product_id: string
          value_id: string
        }
        Insert: {
          axis_id: string
          product_id: string
          value_id: string
        }
        Update: {
          axis_id?: string
          product_id?: string
          value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_assignments_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "product_option_axes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_shelf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_assignments_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_axes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_ordinal: boolean
          label: string
          sort_priority: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_ordinal?: boolean
          label: string
          sort_priority?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_ordinal?: boolean
          label?: string
          sort_priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_option_values: {
        Row: {
          axis_id: string
          code: string
          created_at: string
          id: string
          label: string
          numeric_rank: number | null
          sort_priority: number
          updated_at: string
        }
        Insert: {
          axis_id: string
          code: string
          created_at?: string
          id?: string
          label: string
          numeric_rank?: number | null
          sort_priority?: number
          updated_at?: string
        }
        Update: {
          axis_id?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          numeric_rank?: number | null
          sort_priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "product_option_axes"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          best_seller: boolean
          brand_id: string
          category_id: string
          created_at: string
          display_name: string
          ean: string | null
          family_id: string
          featured: boolean
          id: string
          itf14: string | null
          lifecycle: Database["public"]["Enums"]["catalogue_lifecycle"]
          low_stock_threshold: number
          offer_price_tzs: number | null
          pack_size_label: string | null
          pack_type: string | null
          price_tzs: number
          size_rank: number | null
          sku: string
          slug: string
          sort_priority: number
          storefront_visible: boolean
          supplier_id: string | null
          updated_at: string
          variant_label: string | null
        }
        Insert: {
          best_seller?: boolean
          brand_id: string
          category_id: string
          created_at?: string
          display_name: string
          ean?: string | null
          family_id: string
          featured?: boolean
          id?: string
          itf14?: string | null
          lifecycle?: Database["public"]["Enums"]["catalogue_lifecycle"]
          low_stock_threshold?: number
          offer_price_tzs?: number | null
          pack_size_label?: string | null
          pack_type?: string | null
          price_tzs: number
          size_rank?: number | null
          sku: string
          slug: string
          sort_priority?: number
          storefront_visible?: boolean
          supplier_id?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Update: {
          best_seller?: boolean
          brand_id?: string
          category_id?: string
          created_at?: string
          display_name?: string
          ean?: string | null
          family_id?: string
          featured?: boolean
          id?: string
          itf14?: string | null
          lifecycle?: Database["public"]["Enums"]["catalogue_lifecycle"]
          low_stock_threshold?: number
          offer_price_tzs?: number | null
          pack_size_label?: string | null
          pack_type?: string | null
          price_tzs?: number
          size_rank?: number | null
          sku?: string
          slug?: string
          sort_priority?: number
          storefront_visible?: boolean
          supplier_id?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_pack_type_fkey"
            columns: ["pack_type"]
            isOneToOne: false
            referencedRelation: "pack_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          created_at: string
          id: boolean
          reservation_expiry_minutes: number | null
          reservation_warning_minutes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          reservation_expiry_minutes?: number | null
          reservation_warning_minutes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          reservation_expiry_minutes?: number | null
          reservation_warning_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          code: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_conflicts: {
        Row: {
          created_at: string
          db_value: Json | null
          detected_at: string
          entity_key: string
          entity_table: string
          field: string
          id: string
          note: string | null
          resolution: Database["public"]["Enums"]["sync_conflict_resolution"]
          resolved_at: string | null
          resolved_by: string | null
          sheet_value: Json | null
          sync_event_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          db_value?: Json | null
          detected_at?: string
          entity_key: string
          entity_table: string
          field: string
          id?: string
          note?: string | null
          resolution?: Database["public"]["Enums"]["sync_conflict_resolution"]
          resolved_at?: string | null
          resolved_by?: string | null
          sheet_value?: Json | null
          sync_event_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          db_value?: Json | null
          detected_at?: string
          entity_key?: string
          entity_table?: string
          field?: string
          id?: string
          note?: string | null
          resolution?: Database["public"]["Enums"]["sync_conflict_resolution"]
          resolved_at?: string | null
          resolved_by?: string | null
          sheet_value?: Json | null
          sync_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_conflicts_sync_event_id_fkey"
            columns: ["sync_event_id"]
            isOneToOne: false
            referencedRelation: "sync_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_events: {
        Row: {
          applied_at: string | null
          base_fingerprint: string | null
          created_at: string
          direction: Database["public"]["Enums"]["sync_direction"]
          entity_id: string | null
          entity_key: string
          entity_table: string
          error_message: string | null
          field_changes: Json
          fingerprint: string
          id: string
          idempotency_key: string
          job_id: string | null
          next_retry_at: string | null
          operation: Database["public"]["Enums"]["sync_operation"]
          retry_count: number
          sheet_row: number | null
          sheet_tab: string | null
          source: Database["public"]["Enums"]["sync_source"]
          status: Database["public"]["Enums"]["sync_status"]
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          base_fingerprint?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["sync_direction"]
          entity_id?: string | null
          entity_key: string
          entity_table: string
          error_message?: string | null
          field_changes?: Json
          fingerprint: string
          id?: string
          idempotency_key: string
          job_id?: string | null
          next_retry_at?: string | null
          operation: Database["public"]["Enums"]["sync_operation"]
          retry_count?: number
          sheet_row?: number | null
          sheet_tab?: string | null
          source: Database["public"]["Enums"]["sync_source"]
          status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          base_fingerprint?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["sync_direction"]
          entity_id?: string | null
          entity_key?: string
          entity_table?: string
          error_message?: string | null
          field_changes?: Json
          fingerprint?: string
          id?: string
          idempotency_key?: string
          job_id?: string | null
          next_retry_at?: string | null
          operation?: Database["public"]["Enums"]["sync_operation"]
          retry_count?: number
          sheet_row?: number | null
          sheet_tab?: string | null
          source?: Database["public"]["Enums"]["sync_source"]
          status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["sync_direction"]
          entity_table: string
          error_detail: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          next_retry_at: string | null
          requested_by: string | null
          retry_count: number
          rows_applied: number
          rows_failed: number
          rows_seen: number
          rows_skipped: number
          source: Database["public"]["Enums"]["sync_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["sync_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["sync_direction"]
          entity_table: string
          error_detail?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          next_retry_at?: string | null
          requested_by?: string | null
          retry_count?: number
          rows_applied?: number
          rows_failed?: number
          rows_seen?: number
          rows_skipped?: number
          source: Database["public"]["Enums"]["sync_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["sync_direction"]
          entity_table?: string
          error_detail?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          next_retry_at?: string | null
          requested_by?: string | null
          retry_count?: number
          rows_applied?: number
          rows_failed?: number
          rows_seen?: number
          rows_skipped?: number
          source?: Database["public"]["Enums"]["sync_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_state: {
        Row: {
          created_at: string
          db_fingerprint: string | null
          entity_id: string | null
          entity_key: string
          entity_table: string
          last_reconciled_at: string | null
          last_source: Database["public"]["Enums"]["sync_source"] | null
          last_synced_at: string | null
          sheet_fingerprint: string | null
          sheet_row: number | null
          sheet_tab: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          db_fingerprint?: string | null
          entity_id?: string | null
          entity_key: string
          entity_table: string
          last_reconciled_at?: string | null
          last_source?: Database["public"]["Enums"]["sync_source"] | null
          last_synced_at?: string | null
          sheet_fingerprint?: string | null
          sheet_row?: number | null
          sheet_tab?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          db_fingerprint?: string | null
          entity_id?: string | null
          entity_key?: string
          entity_table?: string
          last_reconciled_at?: string | null
          last_source?: Database["public"]["Enums"]["sync_source"] | null
          last_synced_at?: string | null
          sheet_fingerprint?: string | null
          sheet_row?: number | null
          sheet_tab?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      inventory_ledger_check: {
        Row: {
          ledger_on_hand: number | null
          ledger_reserved: number | null
          location_code: string | null
          matches: boolean | null
          on_hand: number | null
          product_id: string | null
          reserved: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_shelf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shelf: {
        Row: {
          available: number | null
          best_seller: boolean | null
          brand_id: string | null
          brand_name: string | null
          brand_slug: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          display_name: string | null
          effective_price_tzs: number | null
          family_id: string | null
          family_name: string | null
          family_slug: string | null
          featured: boolean | null
          id: string | null
          image_alt: string | null
          image_bucket: string | null
          image_height: number | null
          image_path: string | null
          image_width: number | null
          in_stock: boolean | null
          low_stock: boolean | null
          offer_price_tzs: number | null
          pack_size_label: string | null
          pack_type: string | null
          price_tzs: number | null
          size_rank: number | null
          sku: string | null
          slug: string | null
          sort_priority: number | null
          variant_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_pack_type_fkey"
            columns: ["pack_type"]
            isOneToOne: false
            referencedRelation: "pack_types"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      jojo_add_stock: {
        Args: { p_product_id: string; p_quantity: number; p_reference?: string }
        Returns: Json
      }
      jojo_admin_id: { Args: never; Returns: string }
      jojo_admin_role: {
        Args: never
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      jojo_advance_order: {
        Args: {
          p_actor_admin_id?: string
          p_order_id: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_payment_reference?: string
          p_to_state: Database["public"]["Enums"]["order_state"]
        }
        Returns: Json
      }
      jojo_cancel_order: {
        Args: {
          p_actor_admin_id?: string
          p_actor_label?: string
          p_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      jojo_claim_first_owner: {
        Args: { p_full_name?: string }
        Returns: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          invited_at: string | null
          last_seen_at: string | null
          phone_e164: string | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "admin_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      jojo_count_stock: {
        Args: { p_counted: number; p_product_id: string; p_reason: string }
        Returns: Json
      }
      jojo_customer_id: { Args: never; Returns: string }
      jojo_fail_delivery: {
        Args: {
          p_actor_admin_id?: string
          p_items_returned: boolean
          p_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      jojo_family_is_public: { Args: { p_family_id: string }; Returns: boolean }
      jojo_is_owner: { Args: never; Returns: boolean }
      jojo_is_staff: { Args: never; Returns: boolean }
      jojo_manages_catalogue: { Args: never; Returns: boolean }
      jojo_media_is_public: { Args: { p_media_id: string }; Returns: boolean }
      jojo_owner_exists: { Args: never; Returns: boolean }
      jojo_owns_order: { Args: { p_order_id: string }; Returns: boolean }
      jojo_place_order: {
        Args: {
          p_channel?: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_note?: string
          p_customer_phone_display?: string
          p_customer_phone_e164: string
          p_delivery_address: string
          p_delivery_instructions?: string
          p_delivery_landmark?: string
          p_items: Json
          p_locale?: string
          p_payment_preference: Database["public"]["Enums"]["payment_preference"]
          p_zone_slug: string
        }
        Returns: Json
      }
      jojo_product_is_public: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      jojo_quote_order: {
        Args: { p_items: Json; p_zone_slug?: string }
        Returns: Json
      }
      jojo_resolve_lines: { Args: { p_items: Json }; Returns: Json }
      jojo_stale_reservations: {
        Args: never
        Returns: {
          order_id: string
          order_number: string
          placed_at: string
          reservation_expires_at: string
          state: Database["public"]["Enums"]["order_state"]
          units: number
        }[]
      }
      jojo_track_order: {
        Args: { p_order_number: string; p_phone_e164: string }
        Returns: Json
      }
      next_order_number: { Args: never; Returns: string }
    }
    Enums: {
      actor_type: "customer" | "staff" | "system" | "sync"
      admin_role: "owner" | "manager" | "order_staff"
      analytics_event_kind:
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
        | "order_delivery_failed"
      catalogue_lifecycle: "draft" | "active" | "hidden" | "archived"
      inventory_movement_kind:
        | "receipt"
        | "stock_count"
        | "correction"
        | "reservation"
        | "reservation_release"
        | "sale"
        | "returned_delivery"
        | "damage_loss"
      media_role: "primary" | "gallery" | "swatch" | "logo" | "icon"
      order_event_kind:
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
        | "staff_action"
      order_state:
        | "new"
        | "awaiting_confirmation"
        | "confirmed"
        | "preparing"
        | "out_for_delivery"
        | "completed"
        | "cancelled"
        | "delivery_failed"
      payment_method: "cash" | "digital"
      payment_preference: "cash_on_delivery" | "digital_on_delivery"
      payment_status: "unpaid" | "paid"
      sync_conflict_resolution:
        | "pending"
        | "sheet_wins"
        | "db_wins"
        | "manual"
        | "ignored"
      sync_direction: "sheet_to_db" | "db_to_sheet"
      sync_operation: "insert" | "update" | "delete" | "upsert"
      sync_source: "sheet" | "admin" | "storefront" | "system"
      sync_status:
        | "pending"
        | "in_progress"
        | "applied"
        | "skipped_echo"
        | "conflict"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actor_type: ["customer", "staff", "system", "sync"],
      admin_role: ["owner", "manager", "order_staff"],
      analytics_event_kind: [
        "page_view",
        "product_impression",
        "product_view",
        "search",
        "add_to_cart",
        "remove_from_cart",
        "checkout_started",
        "order_created",
        "whatsapp_initiated",
        "order_confirmed",
        "order_preparing",
        "order_dispatched",
        "order_completed",
        "order_cancelled",
        "order_delivery_failed",
      ],
      catalogue_lifecycle: ["draft", "active", "hidden", "archived"],
      inventory_movement_kind: [
        "receipt",
        "stock_count",
        "correction",
        "reservation",
        "reservation_release",
        "sale",
        "returned_delivery",
        "damage_loss",
      ],
      media_role: ["primary", "gallery", "swatch", "logo", "icon"],
      order_event_kind: [
        "order_created",
        "state_changed",
        "confirmed",
        "cancelled",
        "delivery_failed",
        "payment_recorded",
        "stock_reserved",
        "stock_released",
        "order_amended",
        "note_added",
        "whatsapp_opened",
        "staff_action",
      ],
      order_state: [
        "new",
        "awaiting_confirmation",
        "confirmed",
        "preparing",
        "out_for_delivery",
        "completed",
        "cancelled",
        "delivery_failed",
      ],
      payment_method: ["cash", "digital"],
      payment_preference: ["cash_on_delivery", "digital_on_delivery"],
      payment_status: ["unpaid", "paid"],
      sync_conflict_resolution: [
        "pending",
        "sheet_wins",
        "db_wins",
        "manual",
        "ignored",
      ],
      sync_direction: ["sheet_to_db", "db_to_sheet"],
      sync_operation: ["insert", "update", "delete", "upsert"],
      sync_source: ["sheet", "admin", "storefront", "system"],
      sync_status: [
        "pending",
        "in_progress",
        "applied",
        "skipped_echo",
        "conflict",
        "failed",
      ],
    },
  },
} as const
