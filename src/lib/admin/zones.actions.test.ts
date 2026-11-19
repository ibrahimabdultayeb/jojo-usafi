import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveZoneAction, type ZonePatch } from "./actions";
import { authorize } from "./authorize";
import { getServerSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("server-only", () => ({}));
vi.mock("./authorize", () => ({ authorize: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getServiceRoleSupabase: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const valid: ZonePatch = { name: "Sample area", feeTzs: 4000, freeDelivery: false, active: true, sortPriority: 1 };
describe("delivery-zone write validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authorize).mockResolvedValue({ok:true} as never);
  });
  it.each([2.5, -1, Number.NaN, 2_147_483_648])("rejects invalid fee %s before a database write", async feeTzs => {
    expect((await saveZoneAction("zone", {...valid, feeTzs})).ok).toBe(false);
    expect(getServerSupabase).not.toHaveBeenCalled();
  });
  it("rejects fractional list positions before a database write", async () => {
    expect((await saveZoneAction("zone", {...valid, sortPriority:1.5})).ok).toBe(false);
    expect(getServerSupabase).not.toHaveBeenCalled();
  });
  it("preserves a free fee and refreshes both public delivery lists", async () => {
    const update = vi.fn().mockReturnValue({eq:vi.fn().mockResolvedValue({error:null})});
    vi.mocked(getServerSupabase).mockResolvedValue({from:vi.fn().mockReturnValue({update})} as never);
    expect((await saveZoneAction("zone", {...valid, freeDelivery:true})).ok).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({fee_tzs:0,free_delivery:true}));
    expect(revalidatePath).toHaveBeenCalledWith("/contact");
    expect(revalidatePath).toHaveBeenCalledWith("/sw/contact");
  });
});
