"use server";

import { revalidateTag } from "next/cache";
import { getAdminSession, isActiveStaff } from "@/lib/admin/session";

/**
 * Make a catalogue change visible now, rather than in five minutes.
 *
 * The storefront caches the whole shelf for five minutes (see
 * `src/lib/catalogue/queries.ts`), which is right for browsing and wrong for an
 * Owner who has just changed a price and wants to check it. This drops that
 * cache on demand.
 *
 * IT IS NOT AN OPEN ENDPOINT. It is a server action that first asks who is
 * calling and refuses anybody who is not active staff — otherwise a stranger
 * could hold the cache open by calling it in a loop, which is a cheap way to
 * make a shop slow. The check is the same `getAdminSession()` the admin screens
 * use, so there is one answer to "is this person staff", not two.
 */
export async function revalidateCatalogue(): Promise<{ ok: boolean; message: string }> {
  const session = await getAdminSession();

  if (!isActiveStaff(session)) {
    return { ok: false, message: "Only signed-in staff can refresh the website." };
  }

  revalidateTag("catalogue");
  return { ok: true, message: "The website has been refreshed." };
}
