/**
 * The shapes the checkout and track-order forms hand back and forth.
 *
 * These live apart from `actions.ts` because a `"use server"` module may only
 * export async functions — everything in it becomes a callable endpoint. A
 * constant exported from there is a build error, and a type exported from there
 * would be an endpoint that does nothing. So the values and types sit here,
 * where a client component can import them without importing the server.
 */

export interface CheckoutProblem {
  readonly kind: string;
  readonly message: string;
}

export interface PlacedOrderSummary {
  readonly orderNumber: string;
  readonly totalTzs: number;
  readonly subtotalTzs: number;
  readonly deliveryFeeTzs: number;
  readonly zoneName: string;
  readonly address: string;
  readonly paymentPreference: string;
  readonly items: {
    sku: string;
    name: string;
    packSize: string | null;
    quantity: number;
    lineTotal: number;
  }[];
}

export interface CheckoutState {
  readonly error: string | null;
  readonly problems: CheckoutProblem[];
  readonly placed: PlacedOrderSummary | null;
}

export const emptyCheckoutState: CheckoutState = { error: null, problems: [], placed: null };

export interface TrackedOrder {
  order_number: string;
  state: string;
  placed_at: string;
  delivery_zone_name: string;
  delivery_address: string;
  subtotal_tzs: number;
  delivery_fee_tzs: number;
  total_tzs: number;
  payment_preference: string;
  payment_status: string;
  customer_name: string;
  items: {
    sku: string;
    product_name: string;
    pack_size: string | null;
    quantity: number;
    line_total_tzs: number;
  }[];
}

export interface TrackState {
  readonly error: string | null;
  readonly order: TrackedOrder | null;
}

export const emptyTrackState: TrackState = { error: null, order: null };
