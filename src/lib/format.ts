import { site } from "./site";

const tzs = new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 });

/** "TSh 32,200" — currency label and amount are styled separately in the UI. */
export function formatPrice(amount: number): string {
  return `${site.currency} ${tzs.format(amount)}`;
}

export function formatAmount(amount: number): string {
  return tzs.format(amount);
}
