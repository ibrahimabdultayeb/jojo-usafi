/**
 * What a product photograph is allowed to be.
 *
 * Pure functions over bytes, with no I/O and no dependencies, so every rule
 * below is provable offline — which matters, because these are the rules that
 * decide what a stranger could get into the shop's Storage bucket if the layers
 * above them ever failed.
 *
 * WHY NOTHING IS TRANSFORMED
 *
 * The obvious design is "accept anything, re-encode it to a square WebP". It is
 * also the design that quietly ruins photographs: re-encoding crops labels when
 * the aspect ratio does not match, shifts a white background off-white, and
 * costs a native image library on every deployment. The 95 photographs already
 * on the shelf were processed once, deterministically, by
 * `scripts/build-catalogue.mjs`, and they are correct.
 *
 * So this VALIDATES instead. An image that is already the right shape and
 * format is stored byte-for-byte; anything else is refused with a sentence
 * saying what to fix. Nothing is distorted because nothing is resized, and the
 * one transformation that exists — none — cannot be applied twice.
 *
 * WHAT IT REFUSES, AND WHY EACH ONE
 *
 *   SVG          it is a document, not a picture: it can carry script, and
 *                sanitising it properly is a project of its own
 *   a lie        the extension and the MIME type are ignored entirely; the
 *                format is read from the first bytes of the file
 *   too big      a 40MB upload is a mistake or an attack, never a product photo
 *   too small    anything under 600px looks broken on a phone at 2x
 *   too oblong   a 4:1 banner is not a product photograph and will be cropped
 *                by every grid it appears in
 */

/** Formats a product photograph may be in. Nothing else is even parsed. */
export type ImageFormat = "webp" | "png" | "jpeg";

export const ALLOWED_MIME: Record<ImageFormat, string> = {
  webp: "image/webp",
  png: "image/png",
  jpeg: "image/jpeg",
};

/** 8MB. Comfortably more than a good photograph, far less than a mistake. */
export const MAX_BYTES = 8 * 1024 * 1024;

/** Below this a photograph looks soft on a phone at 2x. */
export const MIN_EDGE = 600;

/** Above this nothing is gained and the shopper pays for the bytes. */
export const MAX_EDGE = 4000;

/**
 * How far from square a product photograph may be.
 *
 * The shelf draws every card in a square, so a picture further from square than
 * this gets letterboxed or cropped. 1.35 allows an upright bottle photographed
 * portrait without allowing a banner.
 */
export const MAX_ASPECT = 1.35;

export interface ImageFacts {
  readonly format: ImageFormat;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export type Inspection = { ok: true; facts: ImageFacts } | { ok: false; problem: string };

/* ------------------------------------------------------------ the formats */

const be16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const be32 = (b: Uint8Array, at: number) =>
  ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const le32 = (b: Uint8Array, at: number) =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

const startsWith = (bytes: Uint8Array, signature: number[], at = 0) =>
  signature.every((byte, index) => bytes[at + index] === byte);

/** PNG: an 8-byte signature, then an IHDR chunk carrying two big-endian sizes. */
function readPng(bytes: Uint8Array): { width: number; height: number } | null {
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (bytes.length < 24) return null;
  // Bytes 12-15 are the chunk type; it must be IHDR for the sizes to be there.
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") return null;
  return { width: be32(bytes, 16), height: be32(bytes, 20) };
}

/**
 * JPEG: walk the segment markers to the first frame header.
 *
 * The size lives in SOF0…SOF15, which is not at a fixed offset — a file can
 * carry any amount of EXIF and colour-profile data first. Walking is the only
 * correct way, and the loop is bounded so a malformed file cannot spin.
 */
function readJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  if (!startsWith(bytes, [0xff, 0xd8])) return null;

  let at = 2;
  let guard = 0;

  while (at + 9 < bytes.length && guard < 4096) {
    guard += 1;
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }

    const marker = bytes[at + 1];

    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    // Start of scan: the image data begins and there is no frame header after it.
    if (marker === 0xda) return null;

    const length = be16(bytes, at + 2);
    if (length < 2) return null;

    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      return { height: be16(bytes, at + 5), width: be16(bytes, at + 7) };
    }

    at += 2 + length;
  }

  return null;
}

/**
 * WebP: a RIFF container with one of three chunk layouts.
 *
 * VP8  — lossy, sizes at a fixed offset after a 3-byte start code
 * VP8L — lossless, 14 bits each packed into a little-endian word
 * VP8X — extended, 24-bit sizes minus one
 */
function readWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (!startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return null; // RIFF
  if (!startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return null; // WEBP
  if (bytes.length < 30) return null;

  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunk === "VP8 ") {
    if (!startsWith(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
    return { width: be16(bytes, 27) & 0x3fff, height: be16(bytes, 29) & 0x3fff };
  }

  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const packed = le32(bytes, 21);
    return { width: (packed & 0x3fff) + 1, height: ((packed >> 14) & 0x3fff) + 1 };
  }

  if (chunk === "VP8X") {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  return null;
}

/* --------------------------------------------------------- the inspection */

/**
 * What this file actually is, read from its own bytes.
 *
 * The declared MIME type and the filename are deliberately not consulted. Both
 * are supplied by whoever is uploading, and a file called `photo.webp` that
 * announces itself as `image/webp` while containing something else is the whole
 * reason this function exists.
 */
export function inspectImage(bytes: Uint8Array): Inspection {
  if (bytes.length === 0) return { ok: false, problem: "That file is empty." };

  if (bytes.length > MAX_BYTES) {
    return {
      ok: false,
      problem: `That file is ${(bytes.length / 1024 / 1024).toFixed(1)}MB. The largest a product photograph may be is ${MAX_BYTES / 1024 / 1024}MB.`,
    };
  }

  // Said explicitly rather than falling through to "not a picture", because
  // somebody uploading a logo will try this and deserves the real reason.
  const head = new TextDecoder().decode(bytes.slice(0, 400)).trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) {
    return {
      ok: false,
      problem: "SVG files are not accepted — they can carry code. Save the picture as WebP, PNG or JPEG.",
    };
  }

  const png = readPng(bytes);
  const jpeg = png ? null : readJpeg(bytes);
  const webp = png || jpeg ? null : readWebp(bytes);

  const size = png ?? jpeg ?? webp;
  const format: ImageFormat | null = png ? "png" : jpeg ? "jpeg" : webp ? "webp" : null;

  if (!size || !format) {
    return { ok: false, problem: "That is not a WebP, PNG or JPEG picture." };
  }

  if (size.width <= 0 || size.height <= 0) {
    return { ok: false, problem: "That picture reports no size, so it cannot be checked." };
  }

  const shortest = Math.min(size.width, size.height);
  const longest = Math.max(size.width, size.height);

  if (shortest < MIN_EDGE) {
    return {
      ok: false,
      problem: `That picture is ${size.width}×${size.height}. It needs to be at least ${MIN_EDGE} pixels on its shortest side, or it looks soft on a phone.`,
    };
  }

  if (longest > MAX_EDGE) {
    return {
      ok: false,
      problem: `That picture is ${size.width}×${size.height}. Anything over ${MAX_EDGE} pixels only costs the shopper time to load.`,
    };
  }

  const aspect = longest / shortest;
  if (aspect > MAX_ASPECT) {
    return {
      ok: false,
      problem: `That picture is ${size.width}×${size.height}, which is too long and thin for a product card. It would be cropped. Use something closer to square.`,
    };
  }

  return {
    ok: true,
    facts: { format, mime: ALLOWED_MIME[format], width: size.width, height: size.height, bytes: bytes.length },
  };
}

/* -------------------------------------------------------------- the path */

/**
 * Where a product's photograph lives, decided here and nowhere else.
 *
 * `<SKU>/<sku>-primary-<stamp>.<ext>`, matching the convention the 95 existing
 * photographs already follow.
 *
 * THE SKU IS SCRUBBED, NOT TRUSTED. It reaches this function from a URL, and a
 * SKU containing `..` or a slash would otherwise write outside the product's own
 * folder — into another product's, or over a file the shop depends on. Only
 * letters, digits and hyphens survive, so there is no character left that a path
 * can be traversed with.
 *
 * The timestamp means a replacement never overwrites the file it replaces. The
 * old photograph stays in Storage until somebody removes it deliberately, so a
 * mistaken upload is undone by pointing the product back, not by hoping the
 * bytes are recoverable.
 */
export function productMediaPath(sku: string, format: ImageFormat, now = new Date()): string {
  const safe = sku.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (safe.length === 0) throw new Error("A product photograph needs a SKU to belong to.");

  const stamp = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const extension = format === "jpeg" ? "jpg" : format;
  return `${safe}/${safe.toLowerCase()}-primary-${stamp}.${extension}`;
}
