import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaff } from "./staff";
import { getServerSupabase } from "@/lib/supabase/server";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: vi.fn() }));
function response(data: unknown, error: unknown) {
  const query = {select:vi.fn(),order:vi.fn()};
  query.select.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({data,error});
  vi.mocked(getServerSupabase).mockResolvedValue({from:vi.fn().mockReturnValue(query)} as never);
}
describe("staff-list failure reporting", () => {
  beforeEach(() => vi.resetAllMocks());
  it("surfaces an unavailable list instead of saying there are no staff", async () => {
    response(null,{message:"private database error"});
    await expect(getStaff()).rejects.toThrow("Could not load the staff list.");
  });
  it("allows a genuinely empty successful result", async () => {
    response([],null);
    await expect(getStaff()).resolves.toEqual([]);
  });
});
