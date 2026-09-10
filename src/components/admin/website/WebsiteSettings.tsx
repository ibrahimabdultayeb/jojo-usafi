"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Field, SaveState, SectionTitle, Toggle, inputClass } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { can, type Role } from "@/lib/admin/permissions";
import { saveWebsiteAction } from "@/lib/admin/owner-actions";
import type { WebsiteContent } from "@/lib/admin/settings";

/**
 * The words on the homepage, and which parts of it appear.
 *
 * Named slots, not a page builder — the same decision Build 04 made and the
 * reason this screen is still four cards rather than a canvas. What changed is
 * that it saves.
 *
 * Every customer-facing field is a pair: English and Kiswahili, side by side,
 * with the Kiswahili box saying plainly what happens if it is left empty. That
 * is better than a language tab, because an empty translation is invisible
 * behind a tab and obvious beside its English.
 */
export function WebsiteSettings({ content, role }: { content: WebsiteContent; role: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<WebsiteContent>(content);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const mayEdit = can(role, "website.manage");

  const set = <K extends keyof WebsiteContent>(key: K, value: WebsiteContent[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function submit(next: WebsiteContent = draft) {
    setSave("saving");
    setProblem(null);
    startTransition(async () => {
      const result = await saveWebsiteAction(next);
      if (result.ok) {
        setSave("saved");
        router.refresh();
        window.setTimeout(() => setSave("idle"), 3000);
      } else {
        setSave("failed");
        setProblem(result.message);
      }
    });
  }

  /** A pair of boxes for one piece of customer-facing copy. */
  const Pair = ({
    label,
    hint,
    en,
    sw,
    onEn,
    onSw,
    long,
  }: {
    label: string;
    hint?: string;
    en: string | null;
    sw: string | null;
    onEn: (value: string) => void;
    onSw: (value: string) => void;
    long?: boolean;
  }) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} — English`} hint={hint}>
        {long ? (
          <textarea
            value={en ?? ""}
            onChange={(event) => onEn(event.target.value)}
            onBlur={() => submit()}
            disabled={!mayEdit || pending}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base font-semibold focus:border-brand-500 focus:outline-none disabled:bg-slate-100"
          />
        ) : (
          <input
            value={en ?? ""}
            onChange={(event) => onEn(event.target.value)}
            onBlur={() => submit()}
            disabled={!mayEdit || pending}
            className={inputClass}
          />
        )}
      </Field>
      <Field
        label={`${label} — Kiswahili`}
        hint={(sw ?? "").trim() === "" ? "Empty, so the English is shown instead." : undefined}
      >
        {long ? (
          <textarea
            value={sw ?? ""}
            onChange={(event) => onSw(event.target.value)}
            onBlur={() => submit()}
            disabled={!mayEdit || pending}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base font-semibold focus:border-brand-500 focus:outline-none disabled:bg-slate-100"
          />
        ) : (
          <input
            value={sw ?? ""}
            onChange={(event) => onSw(event.target.value)}
            onBlur={() => submit()}
            disabled={!mayEdit || pending}
            className={inputClass}
          />
        )}
      </Field>
    </div>
  );

  return (
    <>
      {problem && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <p role="alert" className="text-sm font-bold text-amber-900">{problem}</p>
        </Card>
      )}

      <SectionTitle action={<SaveState state={save} />}>The strip above the header</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        <Toggle
          label="Show the strip"
          hint={draft.showAnnouncement ? "Customers see it above the header." : "Hidden."}
          checked={draft.showAnnouncement}
          disabled={!mayEdit || pending}
          onChange={(value) => {
            set("showAnnouncement", value);
            submit({ ...draft, showAnnouncement: value });
          }}
        />
        <Pair
          label="Announcement"
          hint="One short line. Leave it empty to use the website's own wording."
          en={draft.announcementEn}
          sw={draft.announcementSw}
          onEn={(value) => set("announcementEn", value)}
          onSw={(value) => set("announcementSw", value)}
        />
      </Card>

      <SectionTitle>The top of the homepage</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        <Pair
          label="Headline"
          en={draft.heroHeadingEn}
          sw={draft.heroHeadingSw}
          onEn={(value) => set("heroHeadingEn", value)}
          onSw={(value) => set("heroHeadingSw", value)}
        />
        <Pair
          label="Supporting line"
          long
          en={draft.heroSubEn}
          sw={draft.heroSubSw}
          onEn={(value) => set("heroSubEn", value)}
          onSw={(value) => set("heroSubSw", value)}
        />
        <Pair
          label="Button words"
          en={draft.heroCtaLabelEn}
          sw={draft.heroCtaLabelSw}
          onEn={(value) => set("heroCtaLabelEn", value)}
          onSw={(value) => set("heroCtaLabelSw", value)}
        />
        <Field label="Where the button goes" hint="A page on this website, like /shop.">
          <input
            value={draft.heroCtaHref ?? ""}
            onChange={(event) => set("heroCtaHref", event.target.value)}
            onBlur={() => submit()}
            disabled={!mayEdit || pending}
            className={inputClass}
            placeholder="/shop"
          />
        </Field>
      </Card>

      <SectionTitle>Promotion band</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        <Toggle
          label="Show the promotion band"
          hint={draft.promoBannerVisible ? "Customers see it on the homepage." : "Hidden."}
          checked={draft.promoBannerVisible}
          disabled={!mayEdit || pending}
          onChange={(value) => {
            set("promoBannerVisible", value);
            submit({ ...draft, promoBannerVisible: value });
          }}
        />
        <Pair
          label="Promotion"
          hint="e.g. Free delivery in Mikocheni this week."
          en={draft.promoBannerEn}
          sw={draft.promoBannerSw}
          onEn={(value) => set("promoBannerEn", value)}
          onSw={(value) => set("promoBannerSw", value)}
        />
      </Card>

      <SectionTitle>What appears on the homepage</SectionTitle>
      <Card className="mb-5 grid gap-2 p-4">
        {/*
          Every switch here removes something the homepage actually draws.
          "Featured products" is deliberately absent: the homepage has no
          featured section to remove, and a switch that changes nothing is
          worse than a missing one. The column stays for when it does.
        */}
        {(
          [
            ["showCategories", "Shop by category", "The row of category tiles"],
            ["showBestSellers", "Best sellers", "Products marked Best seller"],
            ["showCategoryGrids", "Category product rows", "One product row per category"],
            ["showTrust", "Why shop with us", "The three promises band"],
            ["showDeliveryBanner", "Delivery area banner", "The green delivery band"],
            ["showBrands", "Brands we stock", "The brand tiles"],
            ["showHowItWorks", "How ordering works", "The three-step dark band"],
          ] as const
        ).map(([key, label, hint]) => (
          <Toggle
            key={key}
            label={label}
            hint={hint}
            checked={draft[key]}
            disabled={!mayEdit || pending}
            onChange={(value) => {
              set(key, value);
              submit({ ...draft, [key]: value });
            }}
          />
        ))}
      </Card>

      {!mayEdit && (
        <Card className="mb-5 p-4">
          <p className="text-sm font-medium text-slate-500">
            The website is looked after by the Owner and Managers.
          </p>
        </Card>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs font-medium text-slate-600">
        <Icon name="sparkle" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        Changes appear on the website straight away. A Kiswahili box left empty shows the English,
        and a box left empty in both languages uses the website&rsquo;s own wording — nothing is ever
        machine-translated, and nothing here can leave the homepage blank.
      </p>
    </>
  );
}
