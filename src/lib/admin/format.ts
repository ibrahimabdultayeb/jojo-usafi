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
export function whenWords(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Unknown";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - then.getTime()) / 86_400_000);

  if (days < 0) return "Today";
  if (days === 0) return "Yesterday";
  if (days < 7) return `${days + 1} days ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A full timestamp, in one fixed format everywhere in the dashboard. */
export function whenExactly(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
