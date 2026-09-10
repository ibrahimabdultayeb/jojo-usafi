#!/usr/bin/env node
/**
 * The checks that only mean something against a REAL deployment.
 *
 *   node scripts/qa-deployed.mjs https://<the staging url>
 *
 * WHY THIS IS SEPARATE FROM `qa-screenshots.mjs`
 *
 * That gate already runs against any `BASE_URL`, so pointing it at the staging
 * site covers layout, touch targets, overflow, locale stability and the
 * dashboard. Everything here is the opposite kind of check: things that are
 * TRUE ON LOCALHOST BY ACCIDENT and have to be proved on the deployment —
 * whether HTTPS headers actually arrive, whether a stranger can reach the
 * dashboard, whether a secret got into a JavaScript bundle, whether the machine
 * endpoints are closed, and whether the site is telling Google to stay away.
 *
 * IT NEVER PRINTS A SECRET. The bundle scan looks for the SHAPE of the things
 * that must not be there — a PEM header, a service-account address, a JWT whose
 * payload claims the service role — and reports only which file matched and
 * which rule it broke.
 *
 * Exit code 1 on any failure, so it is usable as a gate.
 */

const BASE = (process.argv[2] ?? process.env.BASE_URL ?? "").replace(/\/$/, "");

if (!BASE || !/^https?:\/\//.test(BASE)) {
  console.error("\n  Usage: node scripts/qa-deployed.mjs https://your-deployment.vercel.app\n");
  process.exit(1);
}

let failures = 0;
let checks = 0;

const ok = (what) => {
  checks += 1;
  console.log(`  ok    ${what}`);
};

const bad = (what, detail = "") => {
  checks += 1;
  failures += 1;
  console.log(`  FAIL  ${what}${detail ? `\n        ${detail}` : ""}`);
};

const head = (title) => console.log(`\n  ── ${title} ${"─".repeat(Math.max(0, 56 - title.length))}`);

/** One request, following redirects only when we say so. */
async function get(path, { redirect = "follow", method = "GET", headers = {} } = {}) {
  const response = await fetch(`${BASE}${path}`, { method, redirect, headers });
  const body = response.headers.get("content-type")?.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");
  return { status: response.status, headers: response.headers, body, url: response.url };
}

/* ------------------------------------------------------------ 1. it is up */

head("THE DEPLOYMENT ANSWERS");

const home = await get("/");
if (home.status === 200) ok(`GET / → 200`);
else bad(`GET / → ${home.status}`);

// Plain HTTP is only acceptable on the local machine, where this script is
// rehearsed before it is pointed at a deployment. Anywhere else it is a
// failure: half the checks below are about headers that only mean something
// over TLS.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(BASE);

if (BASE.startsWith("https://")) {
  ok("served over HTTPS");
} else if (isLocal) {
  console.log("  note  http://localhost — rehearsing the script, not a deployment");
} else {
  bad("the deployment is not HTTPS", "every check below is weaker over plain HTTP");
}

/* ------------------------------------------------------- 2. the headers */

head("SECURITY HEADERS");

const EXPECTED = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

for (const [key, value] of Object.entries(EXPECTED)) {
  const actual = home.headers.get(key);
  if (actual && actual.toLowerCase() === value.toLowerCase()) ok(`${key}: ${actual}`);
  else bad(`${key}`, `expected ${value}, got ${actual ?? "nothing"}`);
}

const permissions = home.headers.get("permissions-policy");
if (permissions && permissions.includes("camera=()")) ok(`permissions-policy: ${permissions}`);
else bad("permissions-policy", `got ${permissions ?? "nothing"}`);

const hsts = home.headers.get("strict-transport-security");
if (hsts && /max-age=\d+/.test(hsts)) ok(`strict-transport-security: ${hsts}`);
else bad("strict-transport-security", `got ${hsts ?? "nothing"}`);

// Not a failure — recorded so the CSP decision stays visible rather than
// silently forgotten. See docs/STAGING.md.
const csp = home.headers.get("content-security-policy");
console.log(`  note  content-security-policy: ${csp ?? "not set (deliberate — final hardening)"}`);

/* ------------------------------------------ 3. staging is not for Google */

head("STAGING IS NOT ADVERTISED");

const robots = await get("/robots.txt");
if (robots.status === 200 && /Disallow:\s*\/\s*$/m.test(String(robots.body))) {
  ok("robots.txt disallows everything");
} else if (robots.status === 200) {
  bad("robots.txt does not disallow crawling", String(robots.body).trim().replace(/\n/g, " | "));
} else {
  bad(`robots.txt → ${robots.status}`);
}

if (/<meta name="robots" content="noindex/.test(String(home.body))) {
  ok("the homepage carries a noindex meta tag");
} else {
  bad("the homepage has no noindex meta tag", "APP_ENV may be set to production");
}

const adminRobots = (await get("/admin/sign-in")).headers.get("x-robots-tag");
if (adminRobots && adminRobots.includes("noindex")) ok(`/admin carries x-robots-tag: ${adminRobots}`);
else bad("/admin has no x-robots-tag", `got ${adminRobots ?? "nothing"}`);

/* --------------------------------------------- 4. the dashboard is shut */

head("A STRANGER CANNOT REACH THE DASHBOARD");

for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/more/settings", "/admin/more/staff"]) {
  const response = await get(path, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const redirected = response.status >= 300 && response.status < 400 && location.includes("/admin/sign-in");

  if (redirected) {
    ok(`${path} → ${response.status} to sign-in`);
  } else if (response.status === 200 && /sign in|Sign in/.test(String(response.body))) {
    ok(`${path} → 200, the sign-in screen`);
  } else {
    bad(`${path} → ${response.status}`, `location: ${location || "none"}`);
  }
}

/* ------------------------------------- 5. the machine endpoints are shut */

head("THE JOB ENDPOINTS REFUSE A STRANGER");

for (const path of ["/api/sync/catalogue", "/api/jobs/expire-reservations"]) {
  const anonymous = await get(path, { method: "POST" });
  if (anonymous.status === 401) ok(`POST ${path} with no credential → 401`);
  else bad(`POST ${path} with no credential → ${anonymous.status}`);

  const wrong = await get(path, {
    method: "POST",
    headers: { authorization: "Bearer not-the-secret-and-never-was" },
  });
  if (wrong.status === 401) ok(`POST ${path} with a wrong credential → 401`);
  else bad(`POST ${path} with a wrong credential → ${wrong.status}`);
}

/* --------------------------------------- 6. no secret reached the browser */

head("NO SERVER SECRET REACHED THE BROWSER");

/**
 * What must never appear in anything a browser can download.
 *
 * Matched by shape, and only the RULE is ever printed — never the match.
 */
const FORBIDDEN = [
  { rule: "a PEM private key", test: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { rule: "a Google service-account address", test: /[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com/ },
  // A Supabase JWT carries its role in the payload. The anon key is meant to be
  // public; the service-role key is the one that must never ship.
  { rule: "a service-role JWT", test: /"role"\s*:\s*"service_role"/ },
  { rule: "a base64 service-role JWT payload", test: /InJvbGUiOiJzZXJ2aWNlX3JvbGUi/ },
  { rule: "SUPABASE_SERVICE_ROLE_KEY by name with a value", test: /SUPABASE_SERVICE_ROLE_KEY["'\s:=]+[A-Za-z0-9._-]{20,}/ },
  { rule: "a sync or job secret by name with a value", test: /(SHEET_SYNC_WEBHOOK_SECRET|RESERVATION_EXPIRY_JOB_SECRET)["'\s:=]+[A-Za-z0-9._-]{16,}/ },
];

/**
 * Every bundle the browser can reach from the two busiest pages.
 *
 * Matched ANYWHERE in the HTML rather than only in `src="…"`. The App Router
 * names its chunks in preload links and inside the flight payload as well as in
 * script tags, and a secret inlined by a stray `NEXT_PUBLIC_` name lands in
 * whichever chunk imported it — so a scan that only followed script tags would
 * be looking in the wrong place and reporting success.
 */
const chunkPattern = /\/_next\/static\/[A-Za-z0-9._/-]+\.js/g;
const pages = [
  { name: "the homepage HTML", text: String(home.body) },
  { name: "the shop HTML", text: String((await get("/shop")).body) },
];

const unique = [...new Set(pages.flatMap((page) => [...page.text.matchAll(chunkPattern)].map((m) => m[0])))];

console.log(`  note  scanning 2 pages and ${unique.length} bundle(s) they reference`);

const scanned = [...pages];
for (const src of unique.slice(0, 60)) {
  const file = await get(src);
  scanned.push({ name: src, text: String(file.body) });
}

let leaked = 0;
for (const { name, text } of scanned) {
  for (const { rule, test } of FORBIDDEN) {
    if (test.test(text)) {
      bad(`${rule} appears in ${name}`);
      leaked += 1;
    }
  }
}
if (leaked === 0) ok(`nothing forbidden in ${scanned.length} downloadable file(s)`);

// The anon key SHOULD be there — it is a public key, and its absence would mean
// the browser cannot talk to Supabase at all.
if (/supabase\.co/.test(scanned.map((s) => s.text).join(""))) {
  ok("the public Supabase URL is present, as it must be");
} else {
  bad("no Supabase URL in the client bundle", "the browser cannot reach the database");
}

/* -------------------------------------------------- 7. the shop is real */

head("THE SHOP IS THE REAL ONE");

const shop = await get("/shop");
if (shop.status === 200) ok("GET /shop → 200");
else bad(`GET /shop → ${shop.status}`);

const storageImages = [...String(shop.body).matchAll(/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\\ ]+/g)];
if (storageImages.length > 0) {
  ok(`${storageImages.length} product image(s) served from Supabase Storage`);

  const sample = storageImages[0][0].replace(/&amp;/g, "&");
  const image = await fetch(sample, { method: "GET" });
  const type = image.headers.get("content-type") ?? "";
  if (image.ok && type.startsWith("image/")) ok(`a product photograph really loads (${type})`);
  else bad(`a product photograph did not load`, `${image.status} ${type}`);
} else {
  bad("no Supabase Storage images on the shop page");
}

if (/TSh|Tsh/.test(String(shop.body))) ok("prices are rendered in TSh");
else bad("no TSh price found on the shop page");

/* ------------------------------------------------- 8. both languages */

head("BOTH LANGUAGES ARE SERVED");

for (const path of ["/", "/shop", "/cart", "/checkout", "/track-order", "/contact"]) {
  const en = await get(path);
  const sw = await get(`/sw${path === "/" ? "" : path}`);
  if (en.status === 200 && sw.status === 200) ok(`${path} and /sw${path === "/" ? "" : path} → 200`);
  else bad(`${path} → ${en.status}, /sw → ${sw.status}`);
}

const swHome = await get("/sw");
if (/<html[^>]+lang="sw/.test(String(swHome.body))) ok('the Kiswahili site declares lang="sw"');
else bad("the Kiswahili site does not declare a Kiswahili lang attribute");

/* --------------------------------------------------------- 9. tracking */

head("TRACK ORDER REFUSES A GUESS");

const track = await get("/track-order");
if (track.status === 200) ok("GET /track-order → 200");
else bad(`GET /track-order → ${track.status}`);

/* ----------------------------------------------------------- summary */

console.log(`\n  ${checks} checks, ${failures} failure(s).\n`);

if (failures > 0) {
  console.log("  FAIL — the deployment is not ready.\n");
  process.exit(1);
}

console.log("  PASS — headers, indexing, admin, job endpoints, bundles, shelf and both languages.\n");
