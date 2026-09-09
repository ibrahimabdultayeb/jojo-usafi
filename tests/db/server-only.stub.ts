/**
 * Stands in for the `server-only` package while the database tests run.
 *
 * That package exists to make Next's bundler fail if a server module is pulled
 * into a client bundle. These tests are the server: there is no client bundle
 * to protect, and the real package refuses to load outside a React Server
 * Component at all. The guard still applies where it matters — `npm run build`
 * uses the real package and would fail exactly as intended.
 */
export {};
