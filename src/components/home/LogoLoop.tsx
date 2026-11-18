"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "@/components/ui/LoadingLink";
import ReactBitsLogoLoop, { type LogoItem } from "@/components/ui/LogoLoop";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";

function renderLogo(item: LogoItem) {
  if (!("src" in item)) return item.node;
  return <Image src={item.src} width={128} height={item.height ?? 36} alt={item.alt ?? ""}
    draggable={false} style={{ height: item.height, width: "auto", maxWidth: 128 }} />;
}

/** Brand-strip layout around the actual React Bits animation component. */
export function LogoLoop({ logos, heading, pauseLabel, playLabel }: {
  logos: { slug: string; name: string; height: number; src: string; href: string }[];
  heading: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const [paused, setPaused] = useState(false);
  const { reduced } = useShowroomMotion();
  const items = useMemo<LogoItem[]>(() => logos.map(({ name, height, src, href }) => ({
    src, alt: name, height, href,
  })), [logos]);

  return (
    <section className="showroom-brands" aria-label={heading}>
      <div className="showroom-wrap showroom-brands-label">
        <p className="showroom-label">{heading}</p>
        {!reduced && <button type="button" className="showroom-loop-control" onClick={() => setPaused(!paused)}
          aria-label={paused ? playLabel : pauseLabel} aria-pressed={paused}>
          <svg viewBox="0 0 20 20" aria-hidden="true" width="14" height="14" fill="currentColor">
            {paused ? <path d="M6 3.5 16 10 6 16.5z" /> : <path d="M5 4h3v12H5zm7 0h3v12h-3z" />}
          </svg>
          <span>{paused ? playLabel : pauseLabel}</span>
        </button>}
      </div>
      <div className="showroom-logo-strip">
        {reduced ? (
          <div className="showroom-logos-static">
            <ul>{logos.map(({ slug, name, height, src, href }) => (
              <li key={slug}><Link href={href} aria-label={name}>
                {renderLogo({ src, alt: name, height })}
              </Link></li>
            ))}</ul>
          </div>
        ) : (
          <ReactBitsLogoLoop logos={items} speed={paused ? 0 : 80} direction="left"
            logoHeight={36} gap={44} pauseOnHover scaleOnHover fadeOut fadeOutWidth={0.06}
            intro={false} draggable renderItem={renderLogo} ariaLabel={heading} reducedMotion={false} />
        )}
      </div>
    </section>
  );
}
