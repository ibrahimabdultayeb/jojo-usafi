import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * OPERATIONS, not tests.
 *
 * Everything under `tools/` acts on the real Google Sheet and the real
 * development database. These are things somebody DOES — a staged first sync, a
 * round-trip proof — written as files so each step is reviewable before it runs
 * and repeatable afterwards, rather than typed once into a terminal and lost.
 *
 * They are deliberately kept out of `npm run test` and `npm run test:db`, which
 * must never open Ibrahim's spreadsheet. Every file additionally refuses to do
 * anything unless its own explicit flag is set, so running the whole folder by
 * accident does nothing.
 *
 *   npm run sync:op -- tools/sync/a-recheck.op.ts
 */
export default defineConfig({
  test: {
    include: ["tools/**/*.op.ts"],
    environment: "node",
    fileParallelism: false,
    sequence: { shuffle: false, concurrent: false },
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // See tests/db/server-only.stub.ts — this is the server.
      "server-only": fileURLToPath(new URL("./tests/db/server-only.stub.ts", import.meta.url)),
    },
  },
});
