"use client";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useMemo, useState } from "react";
import type { AdminCatalogueProduct } from "@/lib/catalogue/admin";
import { Badge, EmptyState } from "./ui";
import { Icon } from "@/components/ui/Icon";
import GlideSelect from "@/components/ui/GlideSelect";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { AnimatedList } from "@/components/ui/AnimatedList";

export function CatalogueWorkspace({ products, mode }: { products: AdminCatalogueProduct[]; mode: "inventory" | "media" }) {
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("name");
  const media = mode === "media";
  const brands = useMemo(() => [...new Set(products.map(product => product.brandName).filter(Boolean))].sort(), [products]);
  function matches(product: AdminCatalogueProduct, key: string) {
    switch (key) {
      case "missing": return !product.imageUrl;
      case "photos": return !!product.imageUrl;
      case "low": return product.available > 0 && product.available <= product.lowStockThreshold;
      case "out": return product.available <= 0;
      case "reserved": return product.reserved > 0;
      default: return true;
    }
  }
  const tabs = media ? [{value:"all",label:"All products"},{value:"photos",label:"With photos"},{value:"missing",label:"Missing photos"}] : [
    {value:"all",label:"All products"},{value:"low",label:"Low stock"},{value:"out",label:"Out of stock"},{value:"reserved",label:"Reserved"},
  ];
  const rows = products.filter(product => matches(product, filter) && (!brand || product.brandName === brand) &&
    `${product.sku} ${product.name} ${product.brandName} ${product.packSize}`.toLowerCase().includes(term.trim().toLowerCase()))
    .sort((a,b) => sort === "available" ? a.available - b.available || a.name.localeCompare(b.name) : sort === "reserved" ? b.reserved - a.reserved || a.name.localeCompare(b.name) : a.name.localeCompare(b.name) || a.packSize.localeCompare(b.packSize));
  const resetKey = `${term}:${filter}:${brand}:${sort}`;
  return <>
    <FilterTabs label={media ? "Filter photographs" : "Filter inventory"} value={filter} onChange={setFilter} items={tabs.map(tab => ({...tab,count:products.filter(product => matches(product,tab.value)).length}))}/>
    <div className="admin-order-filters">
      <label className="admin-order-search"><Icon name="search"/><input aria-label="Search products" type="search" placeholder="Search by product, size, brand or SKU" value={term} onChange={event => setTerm(event.target.value)}/></label>
      <GlideSelect ariaLabel="Filter by brand" value={brand} onChange={setBrand} options={[{value:"",label:"All brands"},...brands.map(value=>({value,label:value}))]}/>
      {!media && <GlideSelect ariaLabel="Sort inventory" value={sort} onChange={setSort} options={[{value:"name",label:"Product name"},{value:"available",label:"Lowest stock first"},{value:"reserved",label:"Most reserved first"}]}/>}
      {(term || brand || filter !== "all" || sort !== "name") && <button type="button" onClick={() => {setTerm("");setBrand("");setFilter("all");setSort("name");}}>Clear filters</button>}
    </div>
    <div className="inventory-results"><p className="admin-result-count" role="status">{rows.length} of {products.length} products</p>{!media && <span><span className="inventory-dot"/> Current stock · quantities in units</span>}</div>
    {!rows.length ? <EmptyState title="No products match" body="Try another search, brand or stock filter."/> :
      <AnimatedList as="ul" className="inventory-grid" resetKey={resetKey} label={media ? "Product photographs" : "Product inventory"}>
        {rows.map(product => {
          const empty = product.available <= 0;
          const low = !empty && product.available <= product.lowStockThreshold;
          const href = `/admin/products/${encodeURIComponent(product.sku)}`;
          return <li key={product.sku} className="inventory-card" data-stock={empty ? "out" : low ? "low" : "healthy"}>
            <div className="inventory-card-top"><span className="inventory-brand">{product.brandName || "Product"}</span>{!media && <Badge tone={empty ? "bad" : low ? "warn" : "good"}>{empty ? "Out of stock" : low ? "Low stock" : "In stock"}</Badge>}</div>
            <div className="inventory-product">
              <Link href={href} className={`inventory-photo ${product.imageUrl ? "" : "inventory-photo-missing"}`} aria-label={`View ${product.name}, ${product.packSize}`}>
                {product.imageUrl ? <Image src={product.imageUrl} alt="" width={132} height={136} sizes="132px" className="inventory-product-image"/> : <span><Icon name="image"/><small>Photo needed</small></span>}
              </Link>
              <div className="inventory-identity"><Link href={href}><h2>{product.name}</h2></Link><span className="inventory-size">{product.packSize}</span><p>{product.sku}</p>{product.categoryName && <small>{product.categoryName}</small>}</div>
            </div>
            {!media && <dl className="inventory-quantities"><div><dt>On hand</dt><dd>{product.stock.toLocaleString("en-GB")}</dd></div><div><dt>Reserved</dt><dd>{product.reserved.toLocaleString("en-GB")}</dd></div><div className="inventory-available"><dt>Available</dt><dd>{product.available.toLocaleString("en-GB")}</dd></div></dl>}
            <div className="inventory-card-footer"><span>{media ? product.imageUrl ? "Approved photo" : "No approved photo" : `Low stock at ${product.lowStockThreshold} units`}</span><Link href={href} className="inventory-manage">{media ? product.imageUrl ? "Manage photo" : "Add photo" : "Manage stock"}<Icon name="arrowRight"/></Link></div>
          </li>;
        })}
      </AnimatedList>}
  </>;
}
