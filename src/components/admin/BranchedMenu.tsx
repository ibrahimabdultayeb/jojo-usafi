"use client";

// Adapted from React Bits Branched Menu (MIT + Commons Clause).
// See THIRD_PARTY_NOTICES.md. Uses real Next links and the existing icon set.
import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface BranchLink { href: string; label: string; icon: IconName; count?: number }
export interface BranchSection { label: string; items: BranchLink[] }
export function adminPathActive(path: string, href: string) {
  return href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`);
}

const ROW = 44, PAD = 6, TRUNK = 12, RADIUS = 9, INDENT = 34;
const rowY = (index: number) => PAD + index * ROW + ROW / 2;
const branch = (index: number) => `M ${TRUNK} ${rowY(index) - RADIUS} A ${RADIUS} ${RADIUS} 0 0 0 ${TRUNK + RADIUS} ${rowY(index)} H ${INDENT - 5}`;
const reach = (index: number) => `M ${TRUNK} 0 V ${rowY(index) - RADIUS} A ${RADIUS} ${RADIUS} 0 0 0 ${TRUNK + RADIUS} ${rowY(index)} H ${INDENT - 5}`;

export function BranchedMenu({ sections, pathname, onNavigate }: {
  sections: BranchSection[]; pathname: string; onNavigate?: () => void;
}) {
  const [folded, setFolded] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const id = useId();
  const nav = useRef<HTMLDivElement>(null);
  const heads = useRef<(HTMLButtonElement | null)[]>([]);
  const marker = useRef<HTMLSpanElement>(null);
  const activeSection = sections.findIndex(section => section.items.some(item => adminPathActive(pathname, item.href)));
  const markerShown = activeSection >= 0 && !folded.includes(sections[activeSection].label);

  useLayoutEffect(() => {
    const place = () => {
      const head = heads.current[activeSection];
      if (marker.current && head) marker.current.style.top = `${head.offsetTop + (head.offsetHeight - 16) / 2}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    if (nav.current) observer.observe(nav.current);
    return () => observer.disconnect();
  }, [activeSection, markerShown]);

  return <div ref={nav} className="admin-branch-menu">
    <span ref={marker} className="admin-branch-marker" data-on={markerShown || undefined} aria-hidden="true" />
    {sections.map((section, index) => {
      const open = !folded.includes(section.label);
      const bodyId = `${id}-${index}`;
      const height = PAD * 2 + section.items.length * ROW;
      return <div className="admin-branch-section" key={section.label} data-open={open || undefined}>
        <button ref={element => { heads.current[index] = element; }} type="button" className="admin-branch-head"
          aria-expanded={open} aria-controls={bodyId}
          onClick={() => setFolded(current => open ? [...current, section.label] : current.filter(label => label !== section.label))}>
          <span>{section.label}</span><Icon name="chevronDown" />
        </button>
        <div className="admin-branch-body" id={bodyId} inert={!open} aria-hidden={!open}>
          <div className="admin-branch-fold">
            <div className="admin-branch-tree" style={{ height }} onMouseLeave={() => setHovered(null)}>
              <svg className="admin-branch-lines" width={INDENT} height={height} aria-hidden="true">
                <path className="admin-branch-base" d={`M ${TRUNK} 0 V ${rowY(section.items.length - 1) - RADIUS}`} />
                {section.items.map((item, k) => {
                  const selected = hovered ? hovered === item.href : adminPathActive(pathname, item.href);
                  return <g key={item.href}>
                    <path className="admin-branch-base" d={branch(k)} />
                    <path className="admin-branch-reach" d={reach(k)} pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: selected ? 0 : 1 }} />
                  </g>;
                })}
              </svg>
              {section.items.map(item => <Link key={item.href} href={item.href} className="admin-branch-item"
                aria-current={adminPathActive(pathname, item.href) ? "page" : undefined} tabIndex={open ? 0 : -1}
                onMouseEnter={() => setHovered(item.href)} onFocus={() => setHovered(item.href)} onBlur={() => setHovered(null)} onClick={onNavigate}>
                <Icon name={item.icon} /><span>{item.label}</span>
                {!!item.count && <b className="admin-nav-count">{item.count}</b>}
              </Link>)}
            </div>
          </div>
        </div>
      </div>;
    })}
  </div>;
}
