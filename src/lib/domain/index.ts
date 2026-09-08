/**
 * The Jojo Usafi domain layer.
 *
 * These modules are the business rules of the store, written once, as pure
 * TypeScript with no I/O. They are the twin of the PostgreSQL constraints in
 * `supabase/migrations`: the database refuses impossible rows, and these
 * functions explain to a person why, before the write is attempted.
 *
 * Nothing here imports Supabase, React or Next. That is what makes them
 * testable without a database — which is the whole reason this layer exists
 * before the database does.
 *
 * `scripts/schema-check.mjs` compares the two sides and fails if they drift.
 */

export * from "./result";
export * from "./money";
export * from "./sku";
export * from "./phone";
export * from "./delivery";
export * from "./inventory";
export * from "./orders";
export * from "./customers";
export * from "./content";
export * from "./sync";
