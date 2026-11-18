"use client";

import Image from "next/image";
import { useMemo } from "react";
import Link from "@/components/ui/LoadingLink";
import ReactBitsLogoLoop, { type LogoItem } from "@/components/ui/LogoLoop";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";

function renderLogo(item: LogoItem) {
  if (!("src" in item)) return item.node;
  return <Image src={item.src} width={128} height={item.height ?? 36} alt={item.alt ?? ""}
    draggable={false} style={{ height: item.height, width: "auto", maxWidth: 128 }} />;
}

/** Brand-strip layout around the actual React Bits animation component. */
export function LogoLoop({ logos, heading }: {
  logos: { slug: string; name: string; height: number; src: string; href: string }[];
  heading: string;
}) {
  // This strip is explicitly intended to autoplay. Only the visitor's in-site
  // choice stops it; an inherited OS preference must not silently replace it.
  const { explicitlyReduced } = useShowroomMotion();
  const items = useMemo<LogoItem[]>(() => logos.map(({ name, height, src, href }) => ({
    src, alt: name, height, href,
  })), [logos]);

  return (
    <section className="showroom-brands" aria-label={heading}>
      <div className="showroom-wrap showroom-brands-label">
        <p className="showroom-label">{heading}</p>
      </div>
      <div className="showroom-logo-strip">
        {explicitlyReduced ? (
          <div className="showroom-logos-static">
            <ul>{logos.map(({ slug, name, height, src, href }) => (
              <li key={slug}><Link href={href} aria-label={name}>
                {renderLogo({ src, alt: name, height })}
              </Link></li>
            ))}</ul>
          </div>
        ) : (
          <ReactBitsLogoLoop logos={items} speed={80} direction="left"
            logoHeight={36} gap={44} pauseOnHover scaleOnHover fadeOut fadeOutWidth={0.06}
            intro={false} draggable renderItem={renderLogo} ariaLabel={heading} reducedMotion={false} />
        )}
      </div>
    </section>
  );
}
