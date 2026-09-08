"use client";

import { useState } from "react";
import { Badge, Button, Card, SaveState, SectionTitle, Toggle, inputClass } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { contentDraft, homepageSections } from "@/mocks/admin/data";

/**
 * Website content, without a page builder.
 *
 * Named slots only — the announcement bar, the hero, a banner, and which
 * homepage sections show. An operator can change what the shop says without
 * touching code, and cannot accidentally break the layout, because there is no
 * layout to edit.
 *
 * Every customer-facing field is bilingual. Kiswahili left empty falls back to
 * English on the storefront, which is why the hint says so rather than blocking.
 */

function BilingualField({
  label,
  hint,
  en,
  sw,
  onEn,
  onSw,
  multiline,
}: {
  label: string;
  hint?: string;
  en: string;
  sw: string;
  onEn: (v: string) => void;
  onSw: (v: string) => void;
  multiline?: boolean;
}) {
  const [tab, setTab] = useState<"en" | "sw">("en");
  const value = tab === "en" ? en : sw;
  const setValue = tab === "en" ? onEn : onSw;
  const missing = sw.trim() === "";

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        <span className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {(["en", "sw"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setTab(code)}
              aria-pressed={tab === code}
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-black transition-colors ${
                tab === code ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {code === "en" ? "EN" : "SW"}
              {code === "sw" && missing && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          ))}
        </span>
      </div>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base font-semibold placeholder:font-medium placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
        />
      ) : (
        <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      )}

      <span className="mt-1.5 block text-xs font-medium text-slate-500">
        {tab === "sw" && missing
          ? "Empty Kiswahili shows the English wording instead."
          : (hint ?? " ")}
      </span>
    </div>
  );
}

export function WebsiteEditor() {
  const [draft, setDraft] = useState(contentDraft);
  const [sections, setSections] = useState(homepageSections);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "pending">("idle");

  function mockSave() {
    setSave("saving");
    window.setTimeout(() => setSave("saved"), 700);
    window.setTimeout(() => setSave("idle"), 3400);
  }

  function move(id: string, by: number) {
    setSections((current) => {
      const i = current.findIndex((s) => s.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= current.length) return current;
      const next = [...current];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    mockSave();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SaveState state={save} />
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <Icon name="arrowRight" className="h-4 w-4" />
          Look at the shop
        </a>
      </div>

      <SectionTitle>Announcement bar</SectionTitle>
      <Card className="mb-5 p-4">
        <BilingualField
          label="Message"
          hint="The thin green strip at the very top of the shop."
          en={draft.announcementEn}
          sw={draft.announcementSw}
          onEn={(v) => {
            setDraft({ ...draft, announcementEn: v });
            mockSave();
          }}
          onSw={(v) => {
            setDraft({ ...draft, announcementSw: v });
            mockSave();
          }}
        />
      </Card>

      <SectionTitle>Homepage banner</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        <BilingualField
          label="Headline"
          hint="The big line customers read first."
          en={draft.heroHeadlineEn}
          sw={draft.heroHeadlineSw}
          onEn={(v) => {
            setDraft({ ...draft, heroHeadlineEn: v });
            mockSave();
          }}
          onSw={(v) => {
            setDraft({ ...draft, heroHeadlineSw: v });
            mockSave();
          }}
        />
        <BilingualField
          label="Supporting line"
          multiline
          en={draft.heroSubEn}
          sw={draft.heroSubSw}
          onEn={(v) => {
            setDraft({ ...draft, heroSubEn: v });
            mockSave();
          }}
          onSw={(v) => {
            setDraft({ ...draft, heroSubSw: v });
            mockSave();
          }}
        />
      </Card>

      <SectionTitle>Promotion banner</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        <Toggle
          label="Show the promotion banner"
          hint={draft.bannerVisible ? "Customers can see it now." : "Currently hidden from the shop."}
          checked={draft.bannerVisible}
          onChange={(v) => {
            setDraft({ ...draft, bannerVisible: v });
            mockSave();
          }}
        />
        <BilingualField
          label="Banner message"
          en={draft.bannerEn}
          sw={draft.bannerSw}
          onEn={(v) => {
            setDraft({ ...draft, bannerEn: v });
            mockSave();
          }}
          onSw={(v) => {
            setDraft({ ...draft, bannerSw: v });
            mockSave();
          }}
        />
      </Card>

      <SectionTitle>Featured products and best sellers</SectionTitle>
      <Card className="mb-5 p-4">
        <p className="text-sm font-medium text-slate-600">
          A product appears in these rows when it is switched on in the product itself. Open a
          product and use <span className="font-bold text-slate-900">Featured</span> or{" "}
          <span className="font-bold text-slate-900">Best seller</span>.
        </p>
        <div className="mt-3">
          <Button variant="secondary" icon="cart">
            Choose products
          </Button>
        </div>
      </Card>

      <SectionTitle>What shows on the homepage</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {sections.map((section, i) => (
          <div key={section.id} className="flex items-center gap-3 p-3.5">
            {/* Up/down rather than drag: a drag handle is unusable one-handed
                and invisible to a keyboard. */}
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => move(section.id, -1)}
                disabled={i === 0}
                aria-label={`Move ${section.label} up`}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30"
              >
                <Icon name="chevronDown" className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => move(section.id, 1)}
                disabled={i === sections.length - 1}
                aria-label={`Move ${section.label} down`}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30"
              >
                <Icon name="chevronDown" className="h-4 w-4" />
              </button>
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">{section.label}</span>
              <span className="block text-xs font-medium text-slate-500">{section.description}</span>
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={section.visible}
              aria-label={`Show ${section.label}`}
              onClick={() => {
                setSections((c) => c.map((s) => (s.id === section.id ? { ...s, visible: !s.visible } : s)));
                mockSave();
              }}
              className="flex h-11 w-12 shrink-0 items-center justify-center"
            >
              <span
                className={`relative block h-7 w-12 rounded-full transition-colors ${
                  section.visible ? "bg-brand-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    section.visible ? "left-6" : "left-1"
                  }`}
                />
              </span>
            </button>
          </div>
        ))}
      </Card>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
        <Badge tone="neutral">Prototype</Badge>
        Nothing here changes the live shop yet.
      </p>
    </>
  );
}
