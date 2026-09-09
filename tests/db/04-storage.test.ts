/**
 * Supabase Storage: the buckets and who may write to them.
 *
 * NO PRODUCT PHOTOGRAPHY IS UPLOADED HERE, and none has been uploaded to the
 * development project at all. Build 06 establishes the architecture and its
 * security; moving the 95 approved photographs out of `public/products` and
 * into Storage is later work. What this file writes is a handful of bytes named
 * `zztest/`, to find out whether the rules hold, and it removes them again.
 *
 * The interesting asymmetry being tested: a Manager may replace a photograph,
 * but only an Owner may destroy one. `product_media.media_id` is
 * `on delete restrict`, so a live product page can outlive a careless click —
 * but only if deleting the bytes underneath it is harder than replacing them.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { anonClient, serviceClient, signIn } from "./support";
import { EMAIL, ensureOwnerProfile } from "./fixtures";

type Client = SupabaseClient<Database>;

const db = serviceClient();
const anon = anonClient();

const BUCKET = "product-media";
const PATH = "zztest/zztest-storage-probe.webp";

/** Bytes, not a photograph. The mime type is what the bucket screens on. */
const bytes = () => new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00])], { type: "image/webp" });

let staff: Client;
let manager: Client;
let owner: Client;

beforeAll(async () => {
  await ensureOwnerProfile();
  [staff, manager, owner] = await Promise.all([
    signIn(EMAIL.staff),
    signIn(EMAIL.manager),
    signIn(EMAIL.owner),
  ]);
  await db.storage.from(BUCKET).remove([PATH]);
}, 120_000);

afterAll(async () => {
  await db.storage.from(BUCKET).remove([PATH]);
});

describe("the buckets exist and are configured deliberately", () => {
  it("has the three media buckets, public for reading", async () => {
    const { data, error } = await db.storage.listBuckets();
    expect(error).toBeNull();

    const byId = new Map(data!.map((bucket) => [bucket.id, bucket]));
    for (const id of ["product-media", "brand-media", "site-content"]) {
      expect(byId.has(id), `missing bucket ${id}`).toBe(true);
      expect(byId.get(id)!.public, `${id} should be publicly readable`).toBe(true);
    }
  });

  it("screens uploads by size and type before a byte is written", async () => {
    const { data } = await db.storage.listBuckets();
    const products = data!.find((bucket) => bucket.id === "product-media")!;
    const brands = data!.find((bucket) => bucket.id === "brand-media")!;

    expect(products.file_size_limit).toBe(5_242_880);
    expect(products.allowed_mime_types).toEqual([
      "image/webp",
      "image/png",
      "image/jpeg",
      "image/avif",
    ]);
    expect(brands.file_size_limit).toBe(2_097_152);
  });
});

describe("who may put a photograph in", () => {
  it("refuses a shopper who has not signed in", async () => {
    const { error } = await anon.storage.from(BUCKET).upload(PATH, bytes(), {
      contentType: "image/webp",
    });
    expect(error).not.toBeNull();
  });

  it("refuses Order staff — they advance orders, they do not change the shop", async () => {
    const { error } = await staff.storage.from(BUCKET).upload(PATH, bytes(), {
      contentType: "image/webp",
    });
    expect(error).not.toBeNull();
  });

  it("accepts a Manager", async () => {
    const { data, error } = await manager.storage.from(BUCKET).upload(PATH, bytes(), {
      contentType: "image/webp",
      upsert: true,
    });
    expect(error).toBeNull();
    expect(data?.path).toBe(PATH);
  });

  it("refuses a file type the bucket does not accept", async () => {
    const { error } = await manager.storage
      .from(BUCKET)
      .upload("zztest/zztest-not-an-image.txt", new Blob(["not an image"], { type: "text/plain" }), {
        contentType: "text/plain",
      });
    expect(error).not.toBeNull();
  });
});

describe("who may take one away", () => {
  it("lets anyone read it, because a product photograph is an advertisement", async () => {
    const publicUrl = anon.storage.from(BUCKET).getPublicUrl(PATH).data.publicUrl;
    expect(publicUrl).toContain(`/storage/v1/object/public/${BUCKET}/`);

    const response = await fetch(publicUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");
  });

  /**
   * Storage reports a refused delete the way PostgREST reports a refused
   * UPDATE: not as an error, but as nothing having happened. The policy matched
   * no row, so no object was removed and the response is an empty list. The
   * assertion that matters is therefore not "did it complain" but "is the
   * photograph still there".
   */
  async function expectDeleteRefused(client: Client, who: string): Promise<void> {
    const { data, error } = await client.storage.from(BUCKET).remove([PATH]);
    if (!error) expect(data, `${who} should have removed nothing`).toEqual([]);

    const still = await fetch(
      `${anon.storage.from(BUCKET).getPublicUrl(PATH).data.publicUrl}?cachebust=${Date.now()}`,
    );
    expect(still.status, `the photograph should have survived ${who}`).toBe(200);
  }

  it("refuses Order staff", async () => {
    await expectDeleteRefused(staff, "Order staff");
  });

  it("refuses a Manager — replacing is allowed, destroying is not", async () => {
    await expectDeleteRefused(manager, "a Manager");
  });

  it("allows the Owner", async () => {
    const { error } = await owner.storage.from(BUCKET).remove([PATH]);
    expect(error).toBeNull();

    const gone = await fetch(
      `${anon.storage.from(BUCKET).getPublicUrl(PATH).data.publicUrl}?cachebust=${Date.now()}`,
    );
    expect(gone.status).toBe(400);
  });
});
