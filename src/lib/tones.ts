import type { Tone } from "./catalogue/types";

/**
 * Tones give each brand and category a consistent colour without letting any one
 * brand take over the storefront — Jojo Usafi's own green stays the primary.
 * Hex values are used by the SVG product artwork; Tailwind classes are written
 * out in full because Tailwind cannot see class names built at runtime.
 */

export interface ToneSet {
  /** Deep shade — container body, icon strokes. */
  deep: string;
  /** Mid shade — gradients and caps. */
  mid: string;
  /** Soft shade — artwork backdrop. */
  soft: string;
  /** Tailwind classes for a small tinted chip. */
  chip: string;
  /** Tailwind classes for a tinted icon tile. */
  tile: string;
}

export const tones: Record<Tone, ToneSet> = {
  green: {
    deep: "#15803d",
    mid: "#22c55e",
    soft: "#dcfce7",
    chip: "bg-green-50 text-green-700 border-green-200",
    tile: "bg-green-50 text-green-700",
  },
  lime: {
    deep: "#4d7c0f",
    mid: "#84cc16",
    soft: "#ecfccb",
    chip: "bg-lime-50 text-lime-700 border-lime-200",
    tile: "bg-lime-50 text-lime-700",
  },
  aqua: {
    deep: "#0f766e",
    mid: "#14b8a6",
    soft: "#ccfbf1",
    chip: "bg-teal-50 text-teal-700 border-teal-200",
    tile: "bg-teal-50 text-teal-700",
  },
  sky: {
    deep: "#0369a1",
    mid: "#0ea5e9",
    soft: "#e0f2fe",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    tile: "bg-sky-50 text-sky-700",
  },
  berry: {
    deep: "#be185d",
    mid: "#ec4899",
    soft: "#fce7f3",
    chip: "bg-pink-50 text-pink-700 border-pink-200",
    tile: "bg-pink-50 text-pink-700",
  },
  amber: {
    deep: "#b45309",
    mid: "#f59e0b",
    soft: "#fef3c7",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    tile: "bg-amber-50 text-amber-700",
  },
  violet: {
    deep: "#6d28d9",
    mid: "#8b5cf6",
    soft: "#ede9fe",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    tile: "bg-violet-50 text-violet-700",
  },
  slate: {
    deep: "#334155",
    mid: "#64748b",
    soft: "#e2e8f0",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    tile: "bg-slate-100 text-slate-700",
  },
};

export function toneSet(tone: Tone): ToneSet {
  return tones[tone] ?? tones.green;
}
