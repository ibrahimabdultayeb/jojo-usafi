import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests for the domain layer.
 *
 * These run WITHOUT a database, a browser or a server, which is the point: the
 * business rules of Jojo Usafi are pure functions, so they can be proved
 * correct before Supabase exists. Anything that needs a real PostgreSQL —
 * migrations applying, RLS policies enforcing, concurrent stock reservation —
 * is deliberately absent and belongs to Build 06.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
