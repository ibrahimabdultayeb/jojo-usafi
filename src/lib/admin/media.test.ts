import { describe, expect, it } from "vitest";
import { inspectImage, productMediaPath, MAX_BYTES, MIN_EDGE, MAX_EDGE } from "./media";

/**
 * The rules that decide what can reach the shop's Storage bucket.
 *
 * Every case is built byte by byte rather than read from a file, so the suite
 * still runs on a laptop with no network and no fixtures — and so each test says
 * exactly which bytes it is about.
 */

/* ---------------------------------------------------------- the builders */

function png(width: number, height: number, bytes = 2048): Uint8Array {
  const file = new Uint8Array(Math.max(bytes, 24));
  file.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  file.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR length
  file.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(file.buffer).setUint32(16, width);
  new DataView(file.buffer).setUint32(20, height);
  return file;
}

function jpeg(width: number, height: number, padding = 0): Uint8Array {
  // SOI, an optional APP0 of `padding` bytes, then a SOF0 frame header.
  const app0 = padding > 0 ? 4 + padding : 0;
  const file = new Uint8Array(2 + app0 + 11 + 64);
  let at = 0;
  file.set([0xff, 0xd8], at);
  at += 2;

  if (app0 > 0) {
    file.set([0xff, 0xe0], at);
    new DataView(file.buffer).setUint16(at + 2, 2 + padding);
    at += 4 + padding;
  }

  file.set([0xff, 0xc0], at);
  new DataView(file.buffer).setUint16(at + 2, 17); // segment length
  file[at + 4] = 8; // precision
  new DataView(file.buffer).setUint16(at + 5, height);
  new DataView(file.buffer).setUint16(at + 7, width);
  return file;
}

function webpLossy(width: number, height: number): Uint8Array {
  const file = new Uint8Array(64);
  file.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  file.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  file.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
  file.set([0x9d, 0x01, 0x2a], 23); // start code
  new DataView(file.buffer).setUint16(27, width, false);
  new DataView(file.buffer).setUint16(29, height, false);
  return file;
}

const facts = (result: ReturnType<typeof inspectImage>) => {
  if (!result.ok) throw new Error(`expected an accepted image, got: ${result.problem}`);
  return result.facts;
};

const problem = (result: ReturnType<typeof inspectImage>) => {
  if (result.ok) throw new Error("expected a refusal, got an accepted image");
  return result.problem;
};

/* ------------------------------------------------------------- accepted */

describe("a real product photograph is accepted", () => {
  it("reads a PNG's size from its header", () => {
    expect(facts(inspectImage(png(800, 800)))).toMatchObject({
      format: "png",
      mime: "image/png",
      width: 800,
      height: 800,
    });
  });

  it("reads a WebP's size", () => {
    expect(facts(inspectImage(webpLossy(1000, 1000)))).toMatchObject({
      format: "webp",
      width: 1000,
      height: 1000,
    });
  });

  it("walks past a JPEG's metadata to find the frame header", () => {
    // The size does not sit at a fixed offset: a camera file can carry
    // kilobytes of EXIF first. This is the case that a naive reader gets wrong.
    expect(facts(inspectImage(jpeg(900, 900, 600)))).toMatchObject({
      format: "jpeg",
      width: 900,
      height: 900,
    });
  });

  it("allows a picture that is taller than it is wide, within reason", () => {
    // An upright bottle photographed portrait. 1000×1300 is 1.3, inside 1.35.
    expect(facts(inspectImage(png(1000, 1300))).height).toBe(1300);
  });
});

/* ------------------------------------------------------------- refused */

describe("anything else is refused, and says why", () => {
  it("refuses an empty file", () => {
    expect(problem(inspectImage(new Uint8Array(0)))).toMatch(/empty/i);
  });

  it("refuses SVG by name, because somebody will try it", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(problem(inspectImage(svg))).toMatch(/SVG/);
  });

  it("refuses a file that is not a picture at all", () => {
    expect(problem(inspectImage(new TextEncoder().encode("just some text")))).toMatch(/not a WebP/i);
  });

  it("ignores what a file claims to be and reads its bytes", () => {
    // A PDF header. Nothing about the call site says PDF; only the bytes do.
    const pdf = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n");
    expect(problem(inspectImage(pdf))).toMatch(/not a WebP/i);
  });

  it("refuses a file that is too large", () => {
    const huge = png(800, 800, MAX_BYTES + 1);
    expect(problem(inspectImage(huge))).toMatch(/largest/i);
  });

  it("refuses a picture that is too small to look sharp", () => {
    expect(problem(inspectImage(png(MIN_EDGE - 1, MIN_EDGE - 1)))).toMatch(/at least/i);
  });

  it("refuses a picture that is needlessly enormous", () => {
    expect(problem(inspectImage(png(MAX_EDGE + 1, MAX_EDGE + 1)))).toMatch(/costs the shopper/i);
  });

  it("refuses a shape that a product card would crop", () => {
    // 2000×600 is 3.3 — a banner, not a product photograph.
    expect(problem(inspectImage(png(2000, 600)))).toMatch(/too long and thin/i);
  });
});

/* ---------------------------------------------------------------- paths */

describe("where the file is put", () => {
  const when = new Date("2026-09-11T12:34:56Z");

  it("puts a photograph in its own product's folder", () => {
    expect(productMediaPath("EP01-A02", "webp", when)).toBe(
      "EP01-A02/ep01-a02-primary-20260911123456.webp",
    );
  });

  it("names a JPEG .jpg, as everything else does", () => {
    expect(productMediaPath("EP01-A02", "jpeg", when)).toMatch(/\.jpg$/);
  });

  it("never overwrites the photograph it replaces", () => {
    const first = productMediaPath("EP01-A02", "webp", new Date("2026-09-11T12:00:00Z"));
    const second = productMediaPath("EP01-A02", "webp", new Date("2026-09-11T12:00:01Z"));
    expect(first).not.toBe(second);
  });

  /**
   * The one that matters. The SKU arrives from a URL, and a path built from it
   * naively would let `../` reach another product's folder — or something the
   * shop depends on.
   */
  it("cannot be made to write outside the product's own folder", () => {
    const nasty = productMediaPath("../../EP99-X1", "webp", when);
    expect(nasty).not.toContain("..");
    expect(nasty).not.toContain("/EP99");
    expect(nasty.startsWith("EP99-X1/")).toBe(true);
  });

  it("strips anything that is not a plain SKU character", () => {
    expect(productMediaPath("ep01 a02/../x", "png", when).split("/")[0]).toBe("EP01A02X");
  });

  it("refuses a SKU that is nothing but punctuation", () => {
    expect(() => productMediaPath("../..", "webp", when)).toThrow(/needs a SKU/i);
  });
});
