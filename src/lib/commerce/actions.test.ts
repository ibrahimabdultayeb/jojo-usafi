import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeOrderAction, trackOrderAction } from "./actions";
import { placeOrder, quoteCart } from "./checkout";
import { emptyCheckoutState, emptyTrackState } from "./state";

import { getPublicSupabase } from "@/lib/supabase/public";
import { getDictionary } from "@/lib/i18n";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public", () => ({ getPublicSupabase: vi.fn() }));
vi.mock("./checkout", async (loadOriginal) => ({
  ...await loadOriginal<typeof import("./checkout")>(),
  placeOrder: vi.fn(),
  quoteCart: vi.fn(),
}));

function checkoutForm(cart: unknown) {
  const form = new FormData();
  form.set("cart", JSON.stringify(cart));
  form.set("fullName", "Checkout Test");
  form.set("phone", "0712345678");
  form.set("zoneSlug", "upanga");
  form.set("address", "Test delivery address");
  form.set("paymentPreference", "cash_on_delivery");
  return form;
}

describe("guest checkout validation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("refuses a mixed basket instead of silently leaving out an invalid item", async () => {
    const form = checkoutForm([
      { sku: "EP01-A02", quantity: 1 },
      { sku: "EP04-A06", quantity: 0 },
    ]);

    const result = await placeOrderAction(emptyCheckoutState, form);

    expect(result.error).toMatch(/items and quantities/);
    expect(quoteCart).not.toHaveBeenCalled();
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("reports a temporary quote failure without placing an order", async () => {
    vi.mocked(quoteCart).mockRejectedValue(new Error("Database unavailable"));

    const result = await placeOrderAction(
      emptyCheckoutState,
      checkoutForm([{ sku: "EP01-A02", quantity: 1 }]),
    );

    expect(result.error).toMatch(/try again/i);
    expect(result.placed).toBeNull();
    expect(placeOrder).not.toHaveBeenCalled();
  });
});


describe("checkout contact validation", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects malformed email before any quote or order RPC", async () => {
    const form = checkoutForm([{ sku: "EP01-A02", quantity: 1 }]);
    form.set("email", "not-an-email");
    const result = await placeOrderAction(emptyCheckoutState, form);
    expect(result.error).toMatch(/email address/);
    expect(quoteCart).not.toHaveBeenCalled();
    expect(placeOrder).not.toHaveBeenCalled();
  });
});

describe("tracking recovery", () => {
  beforeEach(() => vi.resetAllMocks());
  function trackingForm(locale = "en") {
    const form = new FormData();
    form.set("locale", locale);
    form.set("orderNumber", " ju-test ");
    form.set("phone", "0712345678");
    return form;
  }
  it("contains transport failures without exposing server details", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("private connection information"));
    vi.mocked(getPublicSupabase).mockReturnValue({ rpc } as never);
    expect(await trackOrderAction(emptyTrackState, trackingForm())).toEqual({ error: getDictionary("en").track.unavailable, order: null });
  });
  it("uses the same localized answer for an unknown order or phone mismatch", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(getPublicSupabase).mockReturnValue({ rpc } as never);
    const result = await trackOrderAction(emptyTrackState, trackingForm("sw"));
    expect(result).toEqual({ error: getDictionary("sw").track.notFound, order: null });
    expect(rpc).toHaveBeenCalledWith("jojo_track_order", { p_order_number: "JU-TEST", p_phone_e164: "+255712345678" });
  });
  it("validates the phone in the selected language before a lookup", async () => {
    const form = trackingForm("sw");
    form.set("phone", "123");
    expect(await trackOrderAction(emptyTrackState, form)).toEqual({ error: getDictionary("sw").track.invalidPhone, order: null });
    expect(getPublicSupabase).not.toHaveBeenCalled();
  });
});
