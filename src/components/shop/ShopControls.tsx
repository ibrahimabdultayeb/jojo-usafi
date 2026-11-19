"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useOptimistic, useTransition } from "react";
import GlideSelect from "@/components/ui/GlideSelect";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { StableText, WidthReserver } from "@/components/ui/StableText";
import type { Category } from "@/lib/catalogue/types";
import { localeVariants } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { showroomCopy } from "@/components/home/showroom-copy";

interface ShopControlsProps {
  categories: Category[];
  activeCategory?: string;
  activeBrand?: string;
  kitchen: boolean;
  activeSort: string;
}

/**
 * LANGUAGE STABILITY
 *   The category chips carry catalogue names, which are English on both sides
 *   of the site and so never move. The two controls that *are* translated are
 *   the leading "All" chip — which would shift every chip after it — and the
 *   sort menu, whose width a browser takes from its widest option. Both reserve
 *   the longest translation so the filter row is the same row in both
 *   languages.
 */

export function ShopControls({ categories, activeCategory, activeBrand, kitchen, activeSort }: ShopControlsProps) {
  const router = useRouter();
  const [sorting, startSort] = useTransition();
  const [filtering, startFilter] = useTransition();
  const active = kitchen ? "need:kitchen" : activeCategory ? `category:${activeCategory}` : activeBrand ? `brand:${activeBrand}` : "all";
  const [optimisticFilter, setOptimisticFilter] = useOptimistic(active);
  const pathname = usePathname();
  const params = useSearchParams();
  const { locale, t } = useLocale();

  const sortOptions = [
    { value: "featured", label: t.shop.sortFeatured },
    { value: "price-asc", label: t.shop.sortPriceAsc },
    { value: "price-desc", label: t.shop.sortPriceDesc },
    { value: "name", label: t.shop.sortName },
  ];

  const hrefWith = useCallback(
    (key: string, value?: string) => {
      const next = new URLSearchParams(params.toString());
      if (key === "category" || key === "need") {
        next.delete("category");
        next.delete("need");
        next.delete("brand");
      }
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  // Every sort label in every language. The widest of them sizes the control.
  const sortReserveVariants = [
    ...localeVariants((d) => d.shop.sortFeatured),
    ...localeVariants((d) => d.shop.sortPriceAsc),
    ...localeVariants((d) => d.shop.sortPriceDesc),
    ...localeVariants((d) => d.shop.sortName),
  ];

  const filters = [
    {value:"all",label:<StableText pick={d=>d.shop.filterAll}>{t.shop.filterAll}</StableText>},
    ...categories.map(category=>({value:`category:${category.slug}`,label:category.name})),
    {value:"need:kitchen",label:showroomCopy(locale).categories[1][0]},
    ...(activeBrand ? [{value:`brand:${activeBrand}`,label:activeBrand}] : []),
  ];
  return <div className="mb-8 flex flex-col gap-4 border-y border-slate-100 py-5 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
    <div data-qa-anchor="shop-filters" className="min-w-0 flex-1">
      <FilterTabs className="shop-filter-tabs" label={t.shop.filterAll} value={optimisticFilter} busy={filtering || sorting} items={filters} onChange={value=>startFilter(()=>{
        setOptimisticFilter(value);
        const [key,slug] = value.split(":");
        router.push(hrefWith(key === "need" ? "need" : "category",value === "all" ? undefined : slug),{scroll:false});
      })}/>
    </div>
    <div data-qa-anchor="shop-sort" className="relative grid w-full shrink-0 grid-cols-1 grid-rows-1 xl:w-auto">
      <GlideSelect id="sort" ariaLabel={t.shop.sortLabel} value={activeSort} onChange={value=>startSort(()=>router.push(hrefWith("sort",value),{scroll:false}))}
        options={sortOptions} busy={sorting} disabled={filtering} className="col-start-1 row-start-1 w-full"/>
      <WidthReserver className="h-12 rounded-xl border border-transparent pr-12 pl-4 text-sm font-bold" variants={sortReserveVariants}/>
    </div>
  </div>;
}
