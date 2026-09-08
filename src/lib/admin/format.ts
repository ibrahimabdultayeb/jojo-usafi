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
