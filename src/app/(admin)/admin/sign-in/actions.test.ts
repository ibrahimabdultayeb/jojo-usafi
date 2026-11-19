import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInAction } from "./actions";
import { requestPasswordLinkAction } from "../forgot-password/actions";
import { getServerSupabase } from "@/lib/supabase/server";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
function form() { const f = new FormData(); f.set("email", "test@example.com"); f.set("password", "test-fixture-only"); return f; }
describe("authentication error recovery", () => {
  beforeEach(() => vi.resetAllMocks());
  it("contains sign-in transport failures without exposing internal details", async () => {
    vi.mocked(getServerSupabase).mockRejectedValue(new Error("private server configuration"));
    expect(await signInAction({error:null}, form())).toEqual({error:"Could not connect to sign in. Please try again."});
  });
  it("uses a neutral message for unknown authentication errors", async () => {
    vi.mocked(getServerSupabase).mockResolvedValue({auth:{signInWithPassword:vi.fn().mockResolvedValue({error:{message:"private service details"}})}} as never);
    const result = await signInAction({error:null}, form());
    expect(result.error).toBe("Could not sign in right now. Please try again.");
  });
  it("reports a reset service outage without confirming whether the account exists", async () => {
    vi.mocked(getServerSupabase).mockResolvedValue({auth:{resetPasswordForEmail:vi.fn().mockResolvedValue({error:{message:"upstream unavailable",status:503}})}} as never);
    expect(await requestPasswordLinkAction({sent:false,error:null}, form())).toEqual({sent:false,error:"Could not request the link right now. Please try again."});
  });
  it("does not falsely report an emailed reset link after a transport failure", async () => {
    vi.mocked(getServerSupabase).mockRejectedValue(new Error("network unavailable"));
    expect(await requestPasswordLinkAction({sent:false,error:null}, form())).toEqual({sent:false,error:"Could not request the link right now. Please try again."});
  });
});
