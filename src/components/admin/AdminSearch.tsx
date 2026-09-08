"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * The admin search box.
 *
 * PROTOTYPE. It routes to the screen most likely to hold the answer rather than
 * searching across everything, because there is no backend to search. The shape
 * is what matters: one box, and staff never have to know which screen a thing
 * lives on. A real global search over orders, customers, phones, products, SKUs
 * and barcodes replaces the routing below without changing this component's
 * place in the shell.
 */
export function AdminSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    if (!q) return;

    // An order number goes straight to orders; anything else is a product or
    // customer lookup, and products are the bigger haystack.
    const looksLikeOrder = /^ju[-\s]?\d+/i.test(q) || /^\d{3,6}$/.test(q);
    const looksLikePhone = q.replace(/\D/g, "").length >= 7;

    if (looksLikeOrder || looksLikePhone) {
      router.push(`/admin/orders?q=${encodeURIComponent(q)}`);
    } else {
      router.push(`/admin/products?q=${encodeURIComponent(q)}`);
    }
    setTerm("");
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative min-w-0 flex-1">
      <label htmlFor="admin-search" className="sr-only">
        Search orders, customers and products
      </label>
      <Icon
        name="search"
        className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
      <input
        id="admin-search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        type="search"
        inputMode="search"
        placeholder="Search order, customer, product…"
        className="min-h-11 w-full rounded-full border border-slate-200 bg-slate-50 pr-4 pl-11 text-sm font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
      />
    </form>
  );
}
