import { describe, expect, it } from "vitest";
import { validateProductionEnvironment } from "./environment";

describe("production environment", () => {
  const production = {
    APP_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://shop.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://production-example.supabase.co",
  };

  it("allows staging to be configured separately", () => {
    expect(() => validateProductionEnvironment({ APP_ENV: "staging" })).not.toThrow();
  });

  it("requires a separate production Supabase project", () => {
    expect(() => validateProductionEnvironment({
      ...production,
      NEXT_PUBLIC_SUPABASE_URL: "https://dyjhacbbedytcstxxjzl.supabase.co/",
    })).toThrow(/own Supabase project/);
  });

  it("keeps Vercel previews in staging mode", () => {
    expect(() => validateProductionEnvironment({ ...production, VERCEL_ENV: "preview" })).toThrow(/APP_ENV=staging/);
  });

  it("requires a valid HTTPS storefront origin", () => {
    expect(() => validateProductionEnvironment({ ...production, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => validateProductionEnvironment(production)).not.toThrow();
  });
});
