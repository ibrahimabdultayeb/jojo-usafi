import Image from "next/image";
import { LogoLoop } from "./LogoLoop";
import Link from "@/components/ui/LoadingLink";
import { Icon, type IconName } from "@/components/ui/Icon";
import { productName } from "@/lib/catalogue/format";
import type { Catalogue, Product } from "@/lib/catalogue/types";
import { formatPrice } from "@/lib/format";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/lib/site-content";
import { showroomCopy } from "./showroom-copy";

const showroomProducts = [
  { name: "multix", sku: "EP01-A02", image: "multix-5l", width: 737, height: 1179 },
  { name: "ozone", sku: "EP05-A03", image: "ozone-15l", width: 509, height: 1178 },
  { name: "softi", sku: "EP09-A07", image: "softi-500ml", width: 501, height: 1178 },
] as const;

const brandLogos = [
  ["multix", "Multix", 34], ["chap-chap", "Chap Chap", 48], ["ozone", "Ozone", 34],
  ["tashu", "Tashu", 32], ["quack", "Quack", 34], ["softi", "Softi", 36],
  ["win", "Win", 45], ["oxy", "Oxy", 41], ["krystal", "Krystal", 31],
  ["greez-off", "Greez Off", 31], ["zero-stain", "Zero Stain", 46],
  ["drainex", "Drainex", 31], ["flax", "Flax", 35], ["surfex", "Surfex", 32],
  ["zaptic", "Zaptic", 38], ["simba", "Simba", 40], ["soapy-soaker", "Soapy Soaker", 41],
  ["bubbles", "Bubbles", 36], ["wow", "Wow", 34], ["lumira", "Lumira", 29],
] as const;

const needTiles = [
  { slug: "laundry-care", theme: "laundry", label: "Ozone · Tashu", images: ["ozone-15l", "tashu-15l"] },
  { slug: null, theme: "kitchen", label: "Chap Chap · Multix", images: ["chap-chap-750ml"] },
  { slug: "washroom-and-surface-care", theme: "washroom", label: "Quack · Zero Stain", images: ["quack-750ml"] },
  { slug: "housekeeping", theme: "housekeeping", label: "Multix · Flax", images: ["multix-5l"] },
  { slug: "personal-care", theme: "personal", label: "Softi · Bubbles", images: ["softi-500ml"] },
] as const;

export function showroomAsset(name: string) {
  return `/showroom/${name}.webp`;
}

export function ShowroomLabel({ children }: { children: string }) {
  return <p className="showroom-label">{children}</p>;
}

export function ShowroomHero({ locale, content, products }: {
  locale: Locale;
  content: SiteContent;
  products: Product[];
}) {
  const copy = showroomCopy(locale);
  const shop = localePath(locale, "/shop");
  const stands = showroomProducts.flatMap((item) => {
    const product = products.find((candidate) => candidate.sku === item.sku);
    return product ? [{ ...item, product }] : [];
  });
  const customHref = content.heroCtaHref;
  const shopHref = customHref?.startsWith("/") && !customHref.startsWith("//")
    ? localePath(locale, customHref)
    : customHref?.startsWith("https://") || customHref?.startsWith("#") ? customHref : shop;

  return (
    <section className="showroom-hero" aria-labelledby="showroom-hero-title">
      <div className="showroom-scene">
        <div className="showroom-scene-edge showroom-scene-edge-left" aria-hidden="true" />
        <div className="showroom-scene-edge showroom-scene-edge-right" aria-hidden="true" />
        <div className="showroom-canvas">
          <Image className="showroom-backdrop" src={showroomAsset("showroom-panorama")} alt="" fill
            sizes="(max-width: 327px) 720px, (max-width: 639px) 220vw, (max-width: 899px) 200vw, (max-width: 1199px) 1800px, (max-width: 1279px) 2197px, (max-width: 1679px) 172vw, 2883px" priority />
          {["one", "two", "three", "four"].map((position) => (
            <span className={`showroom-bubble showroom-bubble-${position}`} aria-hidden="true" key={position} />
          ))}
          {stands.map(({ name, image, width, height, product }) => (
            <Link key={name} className={`showroom-stand-product showroom-stand-${name}`}
              href={localePath(locale, `/product/${product.slug}`)}
              aria-label={`${copy.viewProduct} · ${productName(product)} · ${product.packSize}`}>
              <Image src={showroomAsset(image)} width={width} height={height} alt="" priority />
              <span className="showroom-stand-cue" aria-hidden="true">
                <span>{copy.viewProduct}</span><Icon name="arrowUpRight" />
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className="showroom-hero-overlay">
        <div className="showroom-wrap">
          <div className="showroom-hero-copy">
            <ShowroomLabel>{copy.heroLabel}</ShowroomLabel>
            <h1 id="showroom-hero-title">
              {content.heroHeading ?? <>{copy.heroLines[0]}{" "}<br />{copy.heroLines[1]}<br /><span>{copy.heroLines[2]}</span></>}
            </h1>
            <p className="showroom-hero-lede">{content.heroSub ?? copy.heroBody}</p>
            <div className="showroom-actions">
              <Link className="showroom-button" href={shopHref}>
                {content.heroCtaLabel ?? copy.shopAll}<Icon name="arrowRight" />
              </Link>
              <Link className="showroom-text-link" href={content.sections.categories ? "#shop-by-need" : shop}>
                {copy.browseCategories}<Icon name="arrowUpRight" />
              </Link>
            </div>
            {stands.length > 0 && (
              <div className="showroom-stand-list">
                <div className="showroom-stand-label">{copy.onStand}</div>
                {stands.map(({ product }) => (
                  <Link href={localePath(locale, `/product/${product.slug}`)} key={product.sku}>
                    <span>{productName(product)} <small>· {product.packSize}</small></span>
                    <strong>{formatPrice(product.price)}</strong><Icon name="arrowRight" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BrandMarquee({ locale, brands }: { locale: Locale; brands: Catalogue["brands"] }) {
  const copy = showroomCopy(locale);
  const logos = brandLogos.filter(([slug]) => brands.some((brand) => brand.slug === slug));
  if (!logos.length) return null;
  return <LogoLoop heading={copy.brandFamily}
    pauseLabel={locale === "sw" ? "Sitisha nembo" : "Pause logos"}
    playLabel={locale === "sw" ? "Endeleza nembo" : "Play logos"}
    logos={logos.map(([slug, name, height]) => ({ slug, name, height,
      src: showroomAsset(slug), href: `${localePath(locale, "/shop")}?brand=${slug}` }))} />;
}

export function ShopByNeed({ locale, categories, order }: {
  locale: Locale;
  categories: Catalogue["categories"];
  order: readonly string[] | null;
}) {
  const copy = showroomCopy(locale);
  const shop = localePath(locale, "/shop");
  const visible = needTiles.map((tile, index) => ({ ...tile, index }))
    .filter((tile) => tile.slug === null || categories.some((category) => category.slug === tile.slug));
  const positions = new Map(order?.map((slug, index) => [slug, index] as const));
  if (positions.size) {
    visible.sort((a, b) => (positions.get(a.slug ?? "") ?? 100 + a.index) - (positions.get(b.slug ?? "") ?? 100 + b.index));
  }

  return (
    <section className="showroom-needs" id="shop-by-need" aria-labelledby="showroom-needs-title">
      <div className="showroom-wrap showroom-needs-layout">
        <div className="showroom-needs-intro">
          <ShowroomLabel>{copy.needs}</ShowroomLabel>
          <h2 id="showroom-needs-title">{copy.needsTitle[0]}<br />{copy.needsTitle[1]}</h2>
          <p>{copy.needsBody}</p>
          <div className="showroom-needs-count"><strong>{visible.length}</strong><span>{copy.shoppingPaths}</span></div>
        </div>
        <div className="showroom-need-tiles">
          {visible.map(({ slug, theme, label, images, index }, number) => (
            <Link className={`showroom-need-tile showroom-need-${theme}`} key={theme}
              href={slug ? `${shop}?category=${slug}` : `${shop}?need=kitchen`}>
              <div className="showroom-tile-copy">
                <span>{String(number + 1).padStart(2, "0")} · {copy.categories[index][0]}</span>
                <h3>{copy.categories[index][1]}</h3>
                <p>{label}</p>
              </div>
              <span className="showroom-tile-link">{copy.categories[index][2]}<Icon name="arrowRight" /></span>
              <div className="showroom-tile-art" aria-hidden="true">
                {images.map((image) => (
                  <Image src={showroomAsset(image)} alt="" key={image} width={155} height={224} />
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const benefitIcons: IconName[] = ["package", "wallet", "truck"];
const stepIcons: IconName[] = ["store", "cart", "check", "truck", "wallet"];

export function WhyJojo({ locale, ozone }: { locale: Locale; ozone?: Product }) {
  const copy = showroomCopy(locale);
  const t = getDictionary(locale);
  return (
    <>
      <section className="showroom-why">
        <div className="showroom-wrap showroom-why-layout">
          <div>
            <ShowroomLabel>{copy.why}</ShowroomLabel>
            <h2>{copy.whyTitle[0]}<br />{copy.whyTitle[1]}</h2>
            <p className="showroom-section-lede">{copy.whyBody}</p>
          </div>
          <ul className="showroom-benefits">
            {copy.benefits.map(([title, text], index) => (
              <li key={title}><span><Icon name={benefitIcons[index]} /></span><div><h3>{title}</h3><p>{text}</p></div></li>
            ))}
          </ul>
        </div>
      </section>
      <section className="showroom-proof">
        <div className="showroom-wrap showroom-proof-layout">
          <div className="showroom-proof-intro">
            <ShowroomLabel>{copy.proof}</ShowroomLabel>
            <h2>{copy.proofTitle[0]}<br />{copy.proofTitle[1]}</h2>
          </div>
          <div className="showroom-proof-cards">
            <article>
              <header><strong>{copy.benefits[0][0]}</strong><span className="showroom-warehouse">{copy.warehouse}</span></header>
              {ozone && (
                <Link className="showroom-proof-box showroom-proof-product" href={localePath(locale, `/product/${ozone.slug}`)}>
                  <Image src={showroomAsset("ozone-15l")} width={29} height={60} alt="" />
                  <span><b>{productName(ozone)}</b><small>{ozone.packSize} · {formatPrice(ozone.price)}</small></span>
                  <Icon name="arrowUpRight" />
                </Link>
              )}
              <p>{copy.stockProof}</p>
            </article>
            <article>
              <header><strong>Lipa ukipokea</strong></header>
              <div className="showroom-proof-box showroom-proof-pay">
                <span aria-hidden="true" className="showroom-radio" />
                <span><b>{copy.benefits[1][0]}</b><small>{copy.benefits[1][1]}</small></span>
                <Icon name="wallet" />
              </div>
              <p>{copy.payProof}</p>
            </article>
            <article>
              <header><strong>{copy.benefits[2][0]}</strong><span>{copy.sampleTracking}</span></header>
              <div className="showroom-proof-status">
                <span><Icon name="check" />{t.orderStatus.confirmed}</span>
                <span><Icon name="truck" />{t.orderStatus.out_for_delivery}</span>
                <span><Icon name="house" />{t.orderStatus.completed}</span>
              </div>
              <Link className="showroom-proof-box showroom-proof-zone" href={localePath(locale, "/checkout")}>
                <span>{t.checkout.zone}</span><b>{copy.selectAtCheckout}</b><Icon name="arrowUpRight" />
              </Link>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}

export function OrderingJourney({ locale }: { locale: Locale }) {
  const copy = showroomCopy(locale);
  return (
    <section className="showroom-ordering" id="how-ordering-works">
      <div className="showroom-wrap">
        <header className="showroom-section-heading">
          <div><ShowroomLabel>{copy.ordering}</ShowroomLabel><h2>{copy.orderingTitle}</h2></div>
          <p>{copy.orderingBody}</p>
        </header>
        <ol className="showroom-order-steps">
          {copy.steps.map(([title, body], index) => (
            <li key={title}>
              <span className="showroom-step-icon"><Icon name={stepIcons[index]} /></span>
              <span aria-hidden="true" className="showroom-step-line"><i /></span>
              <span className="showroom-step-number">{copy.stepLabel} {String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3><p>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ClosingShowroom({ locale }: { locale: Locale }) {
  const copy = showroomCopy(locale);
  return (
    <section className="showroom-closing">
      <div className="showroom-wrap">
        <ShowroomLabel>{copy.closeLabel}</ShowroomLabel>
        <h2>{copy.closeTitle[0]}<br /><span>{copy.closeTitle[1]}</span></h2>
        <p>{copy.closeBody}</p>
        <div className="showroom-actions">
          <Link className="showroom-button showroom-button-white" href={localePath(locale, "/shop")}>
            {copy.shopAll}<Icon name="arrowRight" />
          </Link>
          <Link className="showroom-text-link" href={localePath(locale, "/track-order")}>
            {copy.trackOrder}<Icon name="truck" />
          </Link>
        </div>
      </div>
    </section>
  );
}
