/**
 * Pure formatting helpers for the admin.
 *
 * Deliberately outside `components/admin/ui.tsx`, which is a client module:
 * server components need these too, and a client module cannot export a plain
 * function to the server.
 */

export function formatTsh(amount: number): string {
  return `TSh ${amount.toLocaleString("en-TZ")}`;
}

/** "+255 712 884 210" -> "…884 210", for cards where the full number will not fit. */
export function shortPhone(phone: string): string {
  const tail = phone.replace(/\s/g, "").slice(-6);
  return `…${tail.slice(0, 3)} ${tail.slice(3)}`;
}

/**
 * A timestamp as a shopkeeper would say it: "Today", "Yesterday", then a date.
 *
 * Fixed to the shop's own clock rather than the reader's locale so the string
 * is the same on the server and in the browser — a date that changes on
 * hydration is a layout shift the QA gate would catch.
 */
/** Tanzania uses UTC+3 year-round. Keep day boundaries identical on every host. */
export function shopDayStart(now = new Date()): string {
  const day = new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}
export function whenWords(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Unknown";
  const days = Math.round((Date.parse(shopDayStart()) - Date.parse(shopDayStart(then))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-GB", { timeZone: "Africa/Dar_es_Salaam", day: "numeric", month: "short", year: "numeric" });
}
export function whenExactly(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" });
}
