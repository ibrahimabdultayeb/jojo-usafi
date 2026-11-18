import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeOrderAction } from "./actions";
import { placeOrder, quoteCart } from "./checkout";
import { emptyCheckoutState } from "./state";

vi.mock("server-only", () => ({}));
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
