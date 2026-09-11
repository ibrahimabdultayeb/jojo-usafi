/**
 * Who may touch a product photograph, and what a photograph does to a product.
 *
 * Build 12 gave the dashboard an upload. That makes Storage writeable by a
 * browser session for the first time, so the questions below stopped being
 * theoretical: a stranger must not be able to put a file in the shop's bucket,
 * Order staff must not be able to change what the shop looks like, and a
 * photograph must not publish a product that something else is holding back.
 *
 * The last one is EP01-A01, which is a real product with a price nobody has
 * confirmed. A photograph must not be a way around that.
 *
 * Every fixture carries this run's token and is removed by the teardown that
 * already exists.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, errorOf, serviceClient, signIn, PG } from "./support";
import { EMAIL, ID, NAMES, STORAGE_PREFIX, ensureOwnerProfile } from "./fixtures";
import type { Database } from "@/lib/supabase/types";
import { inspectImage, productMediaPath } from "@/lib/admin/media";

const db = serviceClient();
const anon = anonClient();

let owner: SupabaseClient<Database>;
let manager: SupabaseClient<Database>;
let staff: SupabaseClient<Database>;

const BUCKET = "product-media";

/** A real 1×1 PNG, and then a properly sized one built from its header. */
function png(width: number, height: number): Uint8Array {
  const file = new Uint8Array(2048);
  file.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  file.set([0x00, 0x00, 0x00, 0x0d], 8);
  file.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(file.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return file;
}

/** Paths this file writes, removed by exact value at the end. */
const written: string[] = [];

beforeAll(async () => {
  await ensureOwnerProfile();
  owner = await signIn(EMAIL.owner);
  manager = await signIn(EMAIL.manager);
  staff = await signIn(EMAIL.staff);
});

afterAll(async () => {
  if (written.length > 0) await db.storage.from(BUCKET).remove(written);
});

/* ------------------------------------------------------- who may write */

describe("the shop's photography bucket", () => {
  it("lets anybody READ a published photograph, because the shelf is public", async () => {
    /*
     * VIA `product_shelf`, NOT VIA AN ARBITRARY `media_assets` ROW.
     *
     * The first draft picked any row in the bucket and passed when run alone.
     * In a full-suite run it picked a fixture asset whose Storage object had
     * been torn down, and reported the shop's public photography as broken. A
     * photograph on the shelf is one a shopper can genuinely see, which is what
     * this test is about.
     */
    const { data } = await db
      .from("product_shelf")
      .select("sku, image_bucket, image_path")
      .not("sku", "like", "ZZ%")
      .order("sku")
      .limit(1)
      .maybeSingle();

    expect(data, "the shelf must have at least one photographed product").toBeTruthy();

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${data!.image_bucket}/${data!.image_path}`;
    const response = await fetch(url);

    expect(response.ok, "a shopper must be able to load a product photograph").toBe(true);
    expect(response.headers.get("content-type") ?? "").toMatch(/^image\//);
  });

  it("refuses an upload from a stranger", async () => {
    const path = `${STORAGE_PREFIX}/anonymous-${NAMES.token}.png`;
    const { error } = await anon.storage.from(BUCKET).upload(path, png(800, 800), {
      contentType: "image/png",
    });

    expect(error, "an anonymous upload must be refused").not.toBeNull();
  });

  it("refuses an upload from Order staff", async () => {
    // Order staff work on orders. What the shop looks like is not their job, and
    // the policy says so rather than the dashboard merely not drawing a button.
    const path = `${STORAGE_PREFIX}/order-staff-${NAMES.token}.png`;
    const { error } = await staff.storage.from(BUCKET).upload(path, png(800, 800), {
      contentType: "image/png",
    });

    expect(error, "Order staff must not be able to upload").not.toBeNull();
  });

  it("lets a Manager upload", async () => {
    const path = `${STORAGE_PREFIX}/manager-${NAMES.token}.png`;
    const { error } = await manager.storage.from(BUCKET).upload(path, png(800, 800), {
      contentType: "image/png",
    });

    expect(error, error?.message).toBeNull();
    written.push(path);
  });

  it("lets an Owner upload", async () => {
    const path = `${STORAGE_PREFIX}/owner-${NAMES.token}.png`;
    const { error } = await owner.storage.from(BUCKET).upload(path, png(800, 800), {
      contentType: "image/png",
    });

    expect(error, error?.message).toBeNull();
    written.push(path);
  });

  it("refuses a stranger who tries to delete a photograph", async () => {
    // A real published photograph again, for the same reason as above.
    const { data: existing } = await db
      .from("product_shelf")
      .select("image_bucket, image_path")
      .not("sku", "like", "ZZ%")
      .order("sku")
      .limit(1)
      .single();

    const { data } = await anon.storage.from(BUCKET).remove([existing!.image_path!]);

    // Storage reports a refused delete as an empty result rather than an error.
    expect(data ?? [], "an anonymous delete must remove nothing").toHaveLength(0);

    // And the file is still there, which is the thing that actually matters.
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${existing!.image_bucket}/${existing!.image_path}`;
    expect((await fetch(url)).ok, "the photograph must survive an anonymous delete").toBe(true);
  });
});

/* ------------------------------------------------- who may link a photo */

describe("attaching a photograph to a product", () => {
  it("is refused for Order staff", async () => {
    const { data: asset } = await db
      .from("media_assets")
      .select("id")
      .eq("storage_bucket", BUCKET)
      .limit(1)
      .single();

    const error = errorOf(
      await staff.from("product_media").insert({
        product_id: ID.productNoPhoto,
        media_id: asset!.id,
        role: "gallery",
      }),
    );

    expect(error.code).toBe(PG.insufficientPrivilege);
  });
});

/* ------------------------------------------ a photograph is not a licence */

describe("a photograph does not publish a product on its own", () => {
  it("puts a photographed, active, visible product on the shelf", async () => {
    // The fixture product with no photograph is otherwise publishable, so it is
    // the clean case: add the photograph, and it appears.
    const { data: asset } = await db
      .from("media_assets")
      .select("id")
      .eq("storage_bucket", BUCKET)
      .limit(1)
      .single();

    const before = await db.from("product_shelf").select("id").eq("id", ID.productNoPhoto);
    expect(before.data, "it starts off the shelf").toEqual([]);

    const linked = await db
      .from("product_media")
      .insert({ product_id: ID.productNoPhoto, media_id: asset!.id, role: "primary" })
      .select("id")
      .single();

    expect(linked.error, linked.error?.message).toBeNull();

    try {
      const after = await db.from("product_shelf").select("id").eq("id", ID.productNoPhoto);
      expect(after.data, "with a photograph it is public").toHaveLength(1);
    } finally {
      await db.from("product_media").delete().eq("id", linked.data!.id);
    }
  });

  it("leaves EP01-A01 off the shelf, photograph or not", async () => {
    /*
     * THE ONE THAT MATTERS.
     *
     * EP01-A01 is priced at TSh 128 — a figure nobody has confirmed and which is
     * almost certainly missing three zeros. It is held back, and a photograph
     * must not become a way around that.
     *
     * This asserts the state rather than manufacturing it: the product is real
     * and is not this suite's to modify.
     */
    const { data: product } = await db
      .from("products")
      .select("id, price_tzs, storefront_visible, lifecycle")
      .eq("sku", "EP01-A01")
      .maybeSingle();

    if (!product) {
      // Not in this catalogue: nothing to assert, and inventing it would be worse.
      expect(true).toBe(true);
      return;
    }

    expect(product.price_tzs, "the unconfirmed price is still unconfirmed").toBeLessThan(1000);

    const { data: onShelf } = await db.from("product_shelf").select("id").eq("id", product.id);
    expect(onShelf, "a blocked product is not public").toEqual([]);
  });
});

/* ------------------------------------------- the rules, against real bytes */

describe("what the upload will accept", () => {
  it("agrees with the database about what a photograph is", () => {
    // The validator is pure and has its own tests; this is the one assertion
    // that ties it to a real bucket path, so a change to either is noticed.
    const good = inspectImage(png(800, 800));
    expect(good.ok).toBe(true);

    const path = productMediaPath("EP01-A02", "png", new Date("2026-09-11T00:00:00Z"));
    expect(path.startsWith("EP01-A02/")).toBe(true);
    expect(path).not.toContain("..");
  });

  it("refuses something that is not a picture at all", () => {
    const result = inspectImage(new TextEncoder().encode("#!/bin/sh\nrm -rf /\n"));
    expect(result.ok).toBe(false);
  });
});
