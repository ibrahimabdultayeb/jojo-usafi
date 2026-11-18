"use client";

import Link from "@/components/ui/LoadingLink";
import { useEffect, useRef, useState } from "react";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";
import { Icon } from "@/components/ui/Icon";
import { localePath, type Locale } from "@/lib/i18n";
import { ShowroomLabel, showroomAsset } from "./Showroom";
import { showroomCopy } from "./showroom-copy";

export function SurfexStory({ locale, slug }: { locale: Locale; slug: string }) {
  const copy = showroomCopy(locale);
  const { reduced } = useShowroomMotion();
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [canScrub, setCanScrub] = useState(false);
  const [nearby, setNearby] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px) and (min-height: 610px)");
    const update = () => setCanScrub(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const scrub = canScrub && !reduced;
  useEffect(() => {
    if (!section.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearby(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const feature = section.current;
    const panel = stage.current;
    const clip = video.current;
    if (!scrub || !feature || !panel || !clip) return;
    clip.pause();
    let frame = 0;
    function renderFrame() {
      frame = 0;
      if (!feature || !panel || !clip || !Number.isFinite(clip.duration) || clip.seeking) return;
      const bounds = feature.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
      const top = parseFloat(window.getComputedStyle(panel).top) || 0;
      const travel = Math.max(1, bounds.height - panel.offsetHeight);
      const progress = Math.min(1, Math.max(0, (top - bounds.top) / (travel * 0.88)));
      const target = progress * Math.max(0, clip.duration - 0.04);
      if (Math.abs(clip.currentTime - target) > 0.04) clip.currentTime = target;
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(renderFrame);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    clip.addEventListener("loadedmetadata", schedule);
    clip.addEventListener("seeked", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      clip.removeEventListener("loadedmetadata", schedule);
      clip.removeEventListener("seeked", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [scrub, nearby]);

  return (
    <section className="showroom-surfex" aria-labelledby="showroom-surfex-title" ref={section} data-scroll-video={scrub || undefined}>
      <div className="showroom-surfex-stage" ref={stage}>
        <div className="showroom-surfex-layout">
          <div>
            <ShowroomLabel>{copy.inAction}</ShowroomLabel>
            <h2 id="showroom-surfex-title">{copy.surfexTitle}</h2>
            <p>{copy.surfexBody}</p><p>{copy.surfexScroll}</p>
            <div className="showroom-actions">
              <Link className="showroom-button showroom-button-white" href={localePath(locale, `/product/${slug}`)}>
                {copy.viewSurfex}<Icon name="arrowRight" />
              </Link>
              <Link className="showroom-text-link" href={`${localePath(locale, "/shop")}?category=washroom-and-surface-care`}>
                {copy.surfaceCare}
              </Link>
            </div>
          </div>
          <figure>
            <video ref={video} preload={nearby && scrub ? "auto" : "none"} poster={showroomAsset("surfex-poster")}
              src="/showroom/surfex-demo.mp4" muted playsInline controls={!scrub} aria-label={copy.surfexVideo} />
            <figcaption>Surfex Surface Cleaner &amp; Sanitizer <span>· 500 ML</span></figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
