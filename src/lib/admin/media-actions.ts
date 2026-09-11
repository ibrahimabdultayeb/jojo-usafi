"use server";

import { createHash } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { authorize } from "./authorize";
import { getServiceRoleSupabase } from "@/lib/supabase/admin";
import { inspectImage, productMediaPath } from "./media";

/**
 * Putting a photograph on a product.
 *
 * THE BYTES NEVER GO STRAIGHT TO STORAGE FROM A BROWSER. A signed upload URL
 * would be simpler and is the wrong shape here: it hands the browser the right
 * to write a file this server has not seen, so every rule in `media.ts` — the
 * format, the size, the shape, the path — would be advice rather than a
 * boundary. The file comes here first, is read, and is refused or stored.
 *
 * FOUR THINGS HAPPEN, IN THIS ORDER, AND THE ORDER IS THE POINT
 *
 *   1. authorize()      — is this person allowed to touch products at all
 *   2. inspectImage()   — is this actually a product photograph
 *   3. Storage          — write the bytes at a path this server decided
 *   4. the database     — record the asset and point the product at it
 *
 * If step 4 fails the file is removed again, so a failed upload cannot leave a
 * photograph in the bucket that no product knows about.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not publish anything. `product_shelf` decides what a shopper sees —
 * active, storefront_visible, and a primary image — and this only ever supplies
 * the third. A product whose price is still blocked, or whose lifecycle is
 * draft, gains a photograph and stays exactly as invisible as it was.
 */

export interface MediaResult {
  readonly ok: boolean;
  readonly message: string;
}

const failed = (message: string): MediaResult => ({ ok: false, message });
const done = (message: string): MediaResult => ({ ok: true, message });

/** The bucket every product photograph lives in. Never taken from a caller. */
const BUCKET = "product-media";

/**
 * Refresh everything that could be showing this product.
 *
 * The shelf is cached for five minutes under the `catalogue` tag, so without
 * this a photograph uploaded now appears up to five minutes later — which reads
 * as "the upload did not work" and produces a second upload.
 */
function refresh(slug: string | null) {
  revalidateTag("catalogue");
  revalidatePath("/admin/products", "page");
  revalidatePath("/", "layout");
  if (slug) {
    revalidatePath(`/product/${slug}`);
    revalidatePath(`/sw/product/${slug}`);
  }
}

export async function uploadProductImageAction(
  sku: string,
  form: FormData,
): Promise<MediaResult> {
  const auth = await authorize("products.editVisibility");
  if (!auth.ok) return failed(auth.message);

  const file = form.get("file");
  if (!(file instanceof File)) return failed("Choose a picture first.");

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Read the file rather than believe it. `file.type` and `file.name` are both
  // supplied by the browser and neither is evidence of anything.
  const inspection = inspectImage(bytes);
  if (!inspection.ok) return failed(inspection.problem);
  const facts = inspection.facts;

  const db = getServiceRoleSupabase();

  const { data: product } = await db
    .from("products")
    .select("id, sku, slug, display_name")
    .eq("sku", sku.toUpperCase())
    .maybeSingle();

  if (!product) return failed("That product is not in the catalogue.");

  /*
   * THE SAME PICTURE TWICE IS NOT AN UPLOAD.
   *
   * A checksum of the exact bytes. Uploading a photograph that is already on
   * this product is almost always a double-click or an impatient second press,
   * and storing it again would leave two identical files and an orphan the
   * moment the product points at one of them.
   */
  const checksum = createHash("sha256").update(bytes).digest("hex");

  const { data: alreadyHere } = await db
    .from("product_media")
    .select("id, role, media_assets ( checksum )")
    .eq("product_id", product.id);

  const duplicate = (alreadyHere ?? []).find((row) => {
    const asset = Array.isArray(row.media_assets) ? row.media_assets[0] : row.media_assets;
    return asset?.checksum === checksum;
  });

  if (duplicate) {
    return failed("That is the picture this product already has.");
  }

  /* ------------------------------------------------------ 3. the bytes */

  const path = productMediaPath(product.sku, facts.format);

  const stored = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: facts.mime,
    // Never overwrite. The path carries a timestamp, so a collision would mean
    // something is wrong that silently replacing a file would hide.
    upsert: false,
    cacheControl: "31536000",
  });

  if (stored.error) return failed(`The picture could not be stored: ${stored.error.message}`);

  /* --------------------------------------------------- 4. the database */

  const asset = await db
    .from("media_assets")
    .insert({
      storage_bucket: BUCKET,
      storage_path: path,
      mime_type: facts.mime,
      width: facts.width,
      height: facts.height,
      byte_size: facts.bytes,
      checksum,
      source_filename: file.name.slice(0, 200),
      alt_text: product.display_name,
    })
    .select("id")
    .single();

  if (asset.error) {
    // Put the bucket back the way it was. A file no row points at is an orphan
    // somebody has to find later.
    await db.storage.from(BUCKET).remove([path]);
    return failed(`The picture could not be recorded: ${asset.error.message}`);
  }

  // One primary per product is a unique index, so the old link goes first.
  const previous = (alreadyHere ?? []).filter((row) => row.role === "primary").map((row) => row.id);
  if (previous.length > 0) {
    await db.from("product_media").delete().in("id", previous);
  }

  const link = await db.from("product_media").insert({
    product_id: product.id,
    media_id: asset.data.id,
    role: "primary",
    sort_priority: 0,
  });

  if (link.error) {
    await db.from("media_assets").delete().eq("id", asset.data.id);
    await db.storage.from(BUCKET).remove([path]);
    return failed(`The picture could not be attached: ${link.error.message}`);
  }

  await db.from("audit_events").insert({
    action: "product.media.upload",
    entity_table: "product_media",
    entity_id: product.id,
    entity_key: product.sku,
    actor_type: "staff",
    actor_admin_id: auth.staff.adminId,
    actor_label: auth.staff.name,
    after_data: {
      width: facts.width,
      height: facts.height,
      format: facts.format,
      bytes: facts.bytes,
      path,
      checksum,
    },
  });

  refresh(product.slug);

  /*
   * WHETHER IT IS NOW PUBLIC IS THE DATABASE'S ANSWER, NOT THIS FUNCTION'S.
   *
   * `product_shelf` is the single definition, and asking it is the only way to
   * be sure — recomputing the rule here would be a second opinion that could
   * drift. It also means the message is honest about EP01-A01: a photograph
   * does not unblock a price nobody has confirmed.
   */
  const { data: onShelf } = await db.from("product_shelf").select("sku").eq("id", product.id);
  const isPublic = (onShelf ?? []).length > 0;

  return done(
    isPublic
      ? `Photograph saved. ${product.sku} is now on the website.`
      : `Photograph saved. ${product.sku} still is not on the website — something else is holding it back.`,
  );
}

/**
 * Take a photograph off a product.
 *
 * The link goes; the file and its `media_assets` row stay. That is deliberate:
 * a photograph removed by mistake is then put back by pointing at it again,
 * and an image that has ever been on the storefront is part of what the shop
 * showed people. The orphan report lists anything left behind, so nothing goes
 * quietly missing.
 */
export async function removeProductImageAction(sku: string): Promise<MediaResult> {
  const auth = await authorize("products.editVisibility");
  if (!auth.ok) return failed(auth.message);

  const db = getServiceRoleSupabase();

  const { data: product } = await db
    .from("products")
    .select("id, sku, slug")
    .eq("sku", sku.toUpperCase())
    .maybeSingle();

  if (!product) return failed("That product is not in the catalogue.");

  const { data: removed, error } = await db
    .from("product_media")
    .delete()
    .eq("product_id", product.id)
    .eq("role", "primary")
    .select("id");

  if (error) return failed(`It could not be removed: ${error.message}`);
  if (!removed || removed.length === 0) return failed("That product has no photograph to remove.");

  await db.from("audit_events").insert({
    action: "product.media.remove",
    entity_table: "product_media",
    entity_id: product.id,
    entity_key: product.sku,
    actor_type: "staff",
    actor_admin_id: auth.staff.adminId,
    actor_label: auth.staff.name,
    after_data: { removed: removed.length },
  });

  refresh(product.slug);

  return done(`Photograph removed. ${product.sku} is off the website until it has one again.`);
}
