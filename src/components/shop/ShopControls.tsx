"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/lib/catalogue/types";
import { useLocale } from "@/lib/i18n/client";

interface ShopControlsProps {
  categories: Category[];
  activeCategory?: string;
  activeSort: string;
}

export function ShopControls({ categories, activeCategory, activeSort }: ShopControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useLocale();

  const sortOptions = [
    { value: "featured", label: t.shop.sortFeatured },
    { value: "price-asc", label: t.shop.sortPriceAsc },
    { value: "price-desc", label: t.shop.sortPriceDesc },
    { value: "name", label: t.shop.sortName },
  ];

  const hrefWith = useCallback(
    (key: string, value?: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  const chip = (active: boolean) =>
    `inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-5 text-sm font-bold shadow-sm transition-all ${
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    }`;

  return (
    <div className="mb-8 flex flex-col gap-4 border-y border-slate-100 py-5 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
        <Link href={hrefWith("category")} className={chip(!activeCategory)}>
          {t.shop.filterAll}
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={hrefWith("category", category.slug)}
            className={chip(activeCategory === category.slug)}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="relative shrink-0">
        <label htmlFor="sort" className="sr-only">
          {t.shop.sortLabel}
        </label>
        <select
          id="sort"
          value={activeSort}
          onChange={(e) => router.push(hrefWith("sort", e.target.value))}
          className="h-12 w-full cursor-pointer appearance-none rounded-full border border-slate-200 bg-white pr-11 pl-5 text-sm font-bold shadow-sm outline-none focus:border-brand-500 md:w-auto"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  );
}
