import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "@/lib/supabase/public";
import { site } from "@/lib/site";

/**
 * How a customer reaches the shop.
 *
 * The same override rule as the website copy, for the same reason: the values
 * live in `shop_settings` and are null until Ibrahim provides them, so a blank
 * one falls back to the placeholder in `src/lib/site.ts` rather than leaving a
 * footer with no telephone number in it.
 *
 * `placeholder` says which ones are still standing in. It is not decoration:
 * `PROTOTYPE_NOTES.md` and the Settings screen both claim these are unset, and
 * a caller that wants to check rather than trust can.
 *
 * ONE QUERY, CACHED under the `catalogue` tag — the same tag the shelf and the
 * website copy use, so an Owner who saves a new telephone number sees it on the
 * site immediately and an ordinary visitor costs nothing.
 */

export interface Contact {
  /** Digits only, as `wa.me` wants them. Never carries a `+`. */
  readonly whatsappNumber: string;
  readonly phone: string;
  readonly email: string;
  readonly addressLine: string;
  readonly placeholder: {
    readonly whatsapp: boolean;
    readonly phone: boolean;
    readonly email: boolean;
    readonly address: boolean;
  };
}

const REVALIDATE_SECONDS = 300;

const loadContact = unstable_cache(
  async () => {
    const { data, error } = await getPublicSupabase()
      .from("shop_settings")
      .select("whatsapp_e164, phone_e164, contact_email, address_line")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  },
  ["shop-contact"],
  { revalidate: REVALIDATE_SECONDS, tags: ["catalogue"] },
);

const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export async function getContact(): Promise<Contact> {
  const row = await loadContact();

  const whatsapp = text(row?.whatsapp_e164);
  const phone = text(row?.phone_e164);
  const email = text(row?.contact_email);
  const address = text(row?.address_line);

  return {
    // `wa.me` takes digits with no punctuation; the column is E.164 with a `+`.
    whatsappNumber: whatsapp ? whatsapp.replace(/[^0-9]/g, "") : site.whatsappNumber,
    phone: phone ?? site.phone,
    email: email ?? site.email,
    addressLine: address ?? site.addressLine,
    placeholder: {
      whatsapp: whatsapp === null,
      phone: phone === null,
      email: email === null,
      address: address === null,
    },
  };
}

/** A WhatsApp link for a given number. Pure, so client components can call it. */
export function whatsappHref(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
