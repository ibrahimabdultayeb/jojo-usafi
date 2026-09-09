import "server-only";

import { createSign } from "node:crypto";

/**
 * The only thing in Jojo Usafi that talks to Google.
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN `googleapis`. The official package is
 * tens of megabytes and carries every Google API there is, to make two HTTP
 * calls. What is actually needed is a signed JWT and two REST endpoints, and
 * writing those out means the exact OAuth scope, the exact URLs and the exact
 * failure handling are all readable on one screen — which, for the component
 * that can overwrite the shop's prices, is worth more than the convenience.
 *
 * THE SCOPE IS `spreadsheets`, NOT `drive`. The service account is given access
 * to ONE spreadsheet, by that spreadsheet being shared with its email address,
 * exactly as a spreadsheet is shared with a colleague. It cannot see, list or
 * open anything else in Ibrahim's Drive — there is no Drive scope to let it.
 *
 * NOTHING HERE IS EVER LOGGED. The private key is read from the environment,
 * used to sign, and never printed, returned, or included in an error. Google's
 * own error bodies are passed through, and those never contain the key.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** How long we wait on Google before deciding the shop should carry on without it. */
const TIMEOUT_MS = 20_000;

export interface GoogleConfig {
  readonly spreadsheetId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly tab: string;
}

export type GoogleStatus =
  | { readonly configured: true; readonly config: GoogleConfig }
  | { readonly configured: false; readonly missing: string[] };

/**
 * Read the settings, and say plainly what is missing rather than half-working.
 *
 * `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` arrives from a `.env` file or a Vercel
 * secret with its newlines escaped, because that is the only way a PEM survives
 * being one line of an environment variable.
 */
export function googleStatus(): GoogleStatus {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const tab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Product Master";

  const missing: string[] = [];
  if (!spreadsheetId) missing.push("GOOGLE_SHEETS_SPREADSHEET_ID");
  if (!clientEmail) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!rawKey) missing.push("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (missing.length > 0) return { configured: false, missing };

  return {
    configured: true,
    config: {
      spreadsheetId: spreadsheetId!,
      clientEmail: clientEmail!,
      privateKey: rawKey!.replace(/\\n/g, "\n"),
      tab,
    },
  };
}

/* ----------------------------------------------------------------- errors */

/** A failure that must never take the shop down — see section 18 of Build 09. */
export class GoogleUnavailable extends Error {
  readonly detail: string;
  constructor(message: string, detail = "") {
    super(message);
    this.name = "GoogleUnavailable";
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ auth */

const base64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cached: CachedToken | null = null;

/**
 * A service-account access token, minted by signing a JWT with the private key
 * and exchanging it. Cached until a minute before it expires, so a sync of 201
 * rows costs one token rather than one per call.
 */
async function accessToken(config: GoogleConfig): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  let signature: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    signature = base64url(signer.sign(config.privateKey));
  } catch {
    // Deliberately not including the exception: a key-parsing error from
    // node:crypto can echo part of the key back.
    throw new GoogleUnavailable(
      "The Google service-account key could not be read.",
      "Check that GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is the whole PEM, including the BEGIN and END lines.",
    );
  }

  const response = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new GoogleUnavailable(
      "Google would not accept the service account.",
      await safeBody(response),
    );
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new GoogleUnavailable("Google returned no access token.");

  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

/** Forget the cached token. Used by the tests and after an auth failure. */
export function resetTokenCache(): void {
  cached = null;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "unreachable";
    throw new GoogleUnavailable(`Google Sheets is ${reason}.`);
  } finally {
    clearTimeout(timer);
  }
}

/** Google's error text, which never contains our credentials. Truncated. */
async function safeBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 400);
  } catch {
    return `HTTP ${response.status}`;
  }
}

/* --------------------------------------------------------------- gateway */

/**
 * What the synchroniser needs from a spreadsheet, and nothing more.
 *
 * An interface rather than a concrete client so the whole engine can be tested
 * against an in-memory sheet — which is how the Build 09 scenarios run without
 * touching Ibrahim's real Product Master.
 */
export interface SheetGateway {
  /** The whole tab, header row first. One call. */
  readGrid(): Promise<(string | number | boolean | null)[][]>;
  /** Many individual cells, in ONE request. */
  writeCells(updates: readonly CellUpdate[]): Promise<void>;
  /** Append the system report columns to the right of the existing headers. */
  appendHeaders(headers: readonly string[], afterColumnCount: number): Promise<void>;
  readonly describe: string;
}

export interface CellUpdate {
  /** 1-based, as a person counts spreadsheet rows. Row 1 is the header row. */
  readonly row: number;
  /** 0-based column index within the tab. */
  readonly column: number;
  readonly value: string | number;
}

/** A1 notation for a zero-based column index: 0 → A, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/** Quote a tab name for A1 notation, because real tab names contain spaces. */
const quoteTab = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

export function googleSheetGateway(config: GoogleConfig): SheetGateway {
  const range = (a1: string) => `${SHEETS_API}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(a1)}`;

  return {
    describe: `${config.spreadsheetId} · ${config.tab}`,

    async readGrid() {
      const token = await accessToken(config);
      // One call for the whole tab. `UNFORMATTED_VALUE` so "TSh 34,000" arrives
      // as 34000 rather than as the display string, and `FORMATTED_STRING` is
      // deliberately not used: a locale-formatted number is a parsing trap.
      const url = `${range(quoteTab(config.tab))}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
      const response = await fetchWithTimeout(url, {
        headers: { authorization: `Bearer ${token}` },
      });

      if (response.status === 403 || response.status === 404) {
        throw new GoogleUnavailable(
          "The service account cannot open that spreadsheet.",
          `Share the sheet with ${config.clientEmail} as an Editor, and check the spreadsheet ID and the tab name "${config.tab}".`,
        );
      }
      if (!response.ok) {
        throw new GoogleUnavailable("Google Sheets refused the read.", await safeBody(response));
      }

      const body = (await response.json()) as { values?: (string | number | boolean | null)[][] };
      return body.values ?? [];
    },

    async writeCells(updates) {
      if (updates.length === 0) return;
      const token = await accessToken(config);

      // ONE request for every cell. Section 14: never a call per cell, and
      // never a whole-sheet rewrite that would clobber a column we do not own.
      const data = updates.map((update) => ({
        range: `${quoteTab(config.tab)}!${columnLetter(update.column)}${update.row}`,
        values: [[update.value]],
      }));

      const response = await fetchWithTimeout(
        `${SHEETS_API}/${encodeURIComponent(config.spreadsheetId)}/values:batchUpdate`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ valueInputOption: "RAW", data }),
        },
      );

      if (!response.ok) {
        throw new GoogleUnavailable("Google Sheets refused the write.", await safeBody(response));
      }
    },

    async appendHeaders(headers, afterColumnCount) {
      if (headers.length === 0) return;
      await this.writeCells(
        headers.map((header, index) => ({
          row: 1,
          column: afterColumnCount + index,
          value: header,
        })),
      );
    },
  };
}
