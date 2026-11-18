"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "@/components/ui/LoadingLink";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";

export function LogoLoop({ logos, heading, pauseLabel, playLabel }: {
  logos: { slug: string; name: string; height: number; src: string; href: string }[];
  heading: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const cycle = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ width: 0, copies: 2 });
  const [paused, setPaused] = useState(false);
  const { reduced } = useShowroomMotion();

  useEffect(() => {
    const measure = () => {
      const width = cycle.current?.getBoundingClientRect().width ?? 0;
      const viewportWidth = viewport.current?.clientWidth ?? 0;
      if (width > 0) {
        const copies = Math.max(2, Math.ceil(viewportWidth / width) + 1);
        setGeometry((previous) => previous.width === width && previous.copies === copies ? previous : { width, copies });
      }
    };
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (cycle.current) observer.observe(cycle.current);
    measure();
    return () => observer.disconnect();
  }, []);

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
      <div ref={viewport} className="showroom-marquee" data-paused={paused || undefined}>
        <div className="showroom-marquee-track" style={{
          "--loop-distance": `${geometry.width}px`,
          animationDuration: `${geometry.width / 55}s`,
          animationPlayState: paused || !geometry.width ? "paused" : undefined,
        } as CSSProperties}>
          {Array.from({ length: geometry.copies }, (_, index) => (
            <div ref={index === 0 ? cycle : undefined} className="showroom-marquee-cycle" key={index} aria-hidden={index > 0 || undefined}>
              {logos.map(({ slug, name, height, src, href }) => (
                <Link key={slug} href={href} tabIndex={index > 0 ? -1 : undefined} aria-label={name}>
                  <Image src={src} width={128} height={height} alt={index > 0 ? "" : name}
                    style={{ height, width: "auto", maxWidth: 128 }} />
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
