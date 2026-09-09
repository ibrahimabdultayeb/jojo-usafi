import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import NamedOrderSequencer from "./tests/db/sequencer";

/**
 * The tests that need a REAL database.
 *
 * Deliberately a second config rather than more files under the first one.
 * `npm run test` must keep working on a laptop with no network, no Docker and
 * no Supabase project — that is what makes the domain layer provable. This
 * suite is the opposite: it proves nothing about business rules and everything
 * about whether PostgreSQL, PostgREST and Supabase Auth behave as assumed.
 *
 *   npm run test      156 domain tests, no I/O            — always runnable
 *   npm run test:db   constraints, triggers, RLS, Auth    — needs .env.local
 *
 * `fileParallelism: false` because there is one database and the files share
 * its fixtures. `testTimeout` is generous because every assertion is a network
 * round trip to Mumbai.
 */
export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/db/global-setup.ts"],
    fileParallelism: false,
    // The files share one database and 02 must run before 03 — see sequencer.ts.
    sequence: { shuffle: false, concurrent: false, sequencer: NamedOrderSequencer },
    testTimeout: 30_000,
    hookTimeout: 120_000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
