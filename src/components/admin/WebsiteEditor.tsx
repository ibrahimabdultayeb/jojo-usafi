"use client";

import { useState } from "react";
import { useRole } from "@/components/admin/RoleContext";
import { Card, Chip, SectionTitle } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import type { LocalisedText, WebsiteContent } from "@/lib/admin/types";
import { localeName, type Locale } from "@/lib/i18n/config";

/**
 * The Website screen.
 *
 * A small number of named things staff can change — not a page builder, and
 * never HTML. Anything a customer reads is edited in both languages side by
 * side, because the storefront ships English and Kiswahili and a half-translated
 * homepage is worse than an untranslated one.
 *
 * PROTOTYPE: edits live on this screen only.
 */
export function WebsiteEditor({
  content,
  productNames,
  categoryNames,
}: {
  content: WebsiteContent;
  /** SKU → readable name, so staff never see a bare code. */
  productNames: Record<string, string>;
  /** slug → readable name. */
  categoryNames: Record<string, string>;
}) {
  const { allows } = useRole();
  const canEdit = allows("website.edit");

  const [draft, setDraft] = useState<WebsiteContent>(content);
  const [language, setLanguage] = useState<Locale>("en");
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<WebsiteContent>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const setText = (value: LocalisedText, next: string): LocalisedText => ({
    ...value,
    [language]: next,
  });

  const field =
    "min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      {/* One language switch for every customer-facing field on the screen. */}
      <div
        role="group"
        aria-label="Language being edited"
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <span className="pl-2 text-xs font-black tracking-widest text-slate-400 uppercase">
          Editing
        </span>
        <div className="ml-auto flex gap-1">
          {(["en", "sw"] as Locale[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLanguage(option)}
              aria-pressed={language === option}
              className={`min-h-11 rounded-full px-4 text-sm font-bold transition-colors ${
                language === option
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {localeName[option]}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <SectionTitle>Announcement bar</SectionTitle>
        <p className="mb-3 text-sm font-medium text-slate-500">
          The messages that scroll across the top of the website.
        </p>
        <div className="space-y-3">
          {draft.announcements.map((announcement, index) => (
            <div key={index}>
              <label
                htmlFor={`announcement-${index}`}
                className="mb-1.5 block text-sm font-bold text-slate-900"
              >
                Message {index + 1}
              </label>
              <input
                id={`announcement-${index}`}
                value={announcement[language]}
                disabled={!canEdit}
                onChange={(e) =>
                  update({
                    announcements: draft.announcements.map((item, i) =>
                      i === index ? setText(item, e.target.value) : item,
                    ),
                  })
                }
                className={field}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Homepage hero</SectionTitle>
        <p className="mb-3 text-sm font-medium text-slate-500">
          The big words at the top of the homepage.
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="hero-title" className="mb-1.5 block text-sm font-bold text-slate-900">
              First line
            </label>
            <input
              id="hero-title"
              value={draft.heroTitle[language]}
              disabled={!canEdit}
              onChange={(e) => update({ heroTitle: setText(draft.heroTitle, e.target.value) })}
              className={field}
            />
          </div>
          <div>
            <label
              htmlFor="hero-subtitle"
              className="mb-1.5 block text-sm font-bold text-slate-900"
            >
              Second line
            </label>
            <input
              id="hero-subtitle"
              value={draft.heroSubtitle[language]}
              disabled={!canEdit}
              onChange={(e) =>
                update({ heroSubtitle: setText(draft.heroSubtitle, e.target.value) })
              }
              className={field}
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Promotional banner</SectionTitle>
        <ContentToggle
          id="promo-on"
          label="Show the banner"
          hint="A single message across the homepage."
          checked={draft.promoBanner.enabled}
          disabled={!canEdit}
          onChange={(value) =>
            update({ promoBanner: { ...draft.promoBanner, enabled: value } })
          }
        />
        {draft.promoBanner.enabled && (
          <div className="mt-3">
            <label htmlFor="promo-text" className="mb-1.5 block text-sm font-bold text-slate-900">
              Banner message
            </label>
            <input
              id="promo-text"
              value={draft.promoBanner.text[language]}
              disabled={!canEdit}
              onChange={(e) =>
                update({
                  promoBanner: {
                    ...draft.promoBanner,
                    text: setText(draft.promoBanner.text, e.target.value),
                  },
                })
              }
              placeholder="e.g. Free delivery this weekend"
              className={field}
            />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Featured products</SectionTitle>
        <p className="mb-3 text-sm font-medium text-slate-500">
          Shown in the featured row. Products are chosen from the catalogue.
        </p>
        <ul className="space-y-2">
          {draft.featuredSkus.map((sku) => (
            <li
              key={sku}
              className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4"
            >
              <span className="min-w-0">
                <span className="block truncate font-display text-sm font-bold text-slate-900">
                  {productNames[sku] ?? sku}
                </span>
                <span className="block text-xs font-semibold text-slate-500">{sku}</span>
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    update({ featuredSkus: draft.featuredSkus.filter((s) => s !== sku) })
                  }
                  aria-label={`Remove ${productNames[sku] ?? sku} from featured`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-medium text-slate-500">
          Adding a product from here needs the product picker, which arrives with the backend.
        </p>
      </Card>

      <Card>
        <SectionTitle>Best sellers</SectionTitle>
        <p className="mb-3 text-sm font-medium text-slate-500">
          The best sellers row on the homepage.
        </p>
        <div className="flex flex-wrap gap-2">
          {draft.bestSellerSkus.map((sku) => (
            <Chip key={sku} tone="neutral">
              {productNames[sku] ?? sku}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Category order</SectionTitle>
        <p className="mb-3 text-sm font-medium text-slate-500">
          The order categories appear in on the homepage.
        </p>
        <ol className="space-y-2">
          {draft.categoryOrder.map((slug, index) => (
            <li
              key={slug}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 px-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-slate-900">
                {categoryNames[slug] ?? slug}
              </span>
              {canEdit && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move ${categoryNames[slug] ?? slug} up`}
                    onClick={() => {
                      const next = [...draft.categoryOrder];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      update({ categoryOrder: next });
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                  >
                    <Icon name="chevronDown" className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    disabled={index === draft.categoryOrder.length - 1}
                    aria-label={`Move ${categoryNames[slug] ?? slug} down`}
                    onClick={() => {
                      const next = [...draft.categoryOrder];
                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                      update({ categoryOrder: next });
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                  >
                    <Icon name="chevronDown" className="h-4 w-4" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <SectionTitle>Homepage sections</SectionTitle>
        <p className="mb-3 text-sm font-medium text-slate-500">
          Turn a whole section of the homepage on or off.
        </p>
        <div className="space-y-2">
          {draft.sections.map((section) => (
            <ContentToggle
              key={section.id}
              id={`section-${section.id}`}
              label={section.label}
              hint={section.visible ? "Customers can see it" : "Hidden from customers"}
              checked={section.visible}
              disabled={!canEdit}
              onChange={(value) =>
                update({
                  sections: draft.sections.map((item) =>
                    item.id === section.id ? { ...item, visible: value } : item,
                  ),
                })
              }
            />
          ))}
        </div>
      </Card>

      <button
        type="button"
        onClick={() => setSaved(true)}
        disabled={!canEdit}
        className="flex min-h-14 w-full items-center justify-center rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
      >
        Save Changes
      </button>

      {saved && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed font-semibold text-amber-900">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          Prototype only — nothing was saved. The website still shows its built-in content.
        </p>
      )}
    </div>
  );
}

function ContentToggle({
  id,
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block font-display text-sm font-bold text-slate-900">{label}</span>
        <span className="block text-xs font-medium text-slate-500">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
