"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Field, SaveState, SectionTitle, inputClass } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { can, type Role } from "@/lib/admin/permissions";
import { saveBusinessAction } from "@/lib/admin/owner-actions";
import type { BusinessSettings, ReservationSettings } from "@/lib/admin/settings";

/**
 * The shop's own details, and how long an unconfirmed order may hold stock.
 *
 * NOTHING HERE IS PREFILLED. Every contact field starts empty and is shown as
 * "Not set yet", because a plausible-looking placeholder phone number is worse
 * than a visibly missing one: the missing one gets fixed before launch, and the
 * plausible one gets discovered by a customer who could not reach anybody.
 *
 * The two reservation times are equally deliberate: they are blank because
 * nobody has decided them, and blank means nothing expires. A default here
 * would be this screen inventing a business rule.
 */
export function ShopSettingsEditor({
  business,
  reservation,
  gaps,
  role,
}: {
  business: BusinessSettings;
  reservation: ReservationSettings;
  gaps: string[];
  role: Role;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(business);
  const [times, setTimes] = useState(reservation);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const mayEdit = can(role, "settings.manage");

  function submit() {
    setSave("saving");
    setProblem(null);
    startTransition(async () => {
      const result = await saveBusinessAction(draft, times);
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

  const minutes = (value: number | null) => (value === null ? "" : String(value));
  const toMinutes = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed.replace(/[^0-9]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return (
    <>
      {gaps.length > 0 && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            {gaps.length} {gaps.length === 1 ? "thing is" : "things are"} still needed before the
            shop opens
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {gaps.map((gap) => (
              <li key={gap}>
                <Badge tone="warn">{gap}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {problem && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <p role="alert" className="text-sm font-bold text-amber-900">{problem}</p>
        </Card>
      )}

      <SectionTitle action={<SaveState state={save} />}>How customers reach you</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        <Field
          label="WhatsApp number"
          hint={draft.whatsappE164 ? "Used by the WhatsApp button." : "Not set yet — the WhatsApp button has nowhere to go."}
        >
          <input
            value={draft.whatsappE164 ?? ""}
            onChange={(event) => setDraft({ ...draft, whatsappE164: event.target.value })}
            onBlur={submit}
            disabled={!mayEdit || pending}
            inputMode="tel"
            placeholder="+255712345678"
            className={inputClass}
          />
        </Field>

        <Field
          label="Phone number"
          hint={draft.phoneE164 ? "Shown on the contact page." : "Not set yet."}
        >
          <input
            value={draft.phoneE164 ?? ""}
            onChange={(event) => setDraft({ ...draft, phoneE164: event.target.value })}
            onBlur={submit}
            disabled={!mayEdit || pending}
            inputMode="tel"
            placeholder="+255712345678"
            className={inputClass}
          />
        </Field>

        <Field label="Email address" hint={draft.contactEmail ? undefined : "Not set yet."}>
          <input
            value={draft.contactEmail ?? ""}
            onChange={(event) => setDraft({ ...draft, contactEmail: event.target.value })}
            onBlur={submit}
            disabled={!mayEdit || pending}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            placeholder="hello@example.com"
            className={inputClass}
          />
        </Field>

        <Field label="Shop address" hint={draft.addressLine ? undefined : "Not set yet."}>
          <input
            value={draft.addressLine ?? ""}
            onChange={(event) => setDraft({ ...draft, addressLine: event.target.value })}
            onBlur={submit}
            disabled={!mayEdit || pending}
            placeholder="Street, area, Dar es Salaam"
            className={inputClass}
          />
        </Field>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-700">Logo</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {business.logoMediaId
              ? "A logo is on file."
              : "Not set yet — the website shows the JOJO USAFI wordmark instead. Uploading one comes with the media screen."}
          </p>
        </div>
      </Card>

      <SectionTitle>How long an order holds stock</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        <p className="text-sm font-medium text-slate-600">
          When somebody orders, the items are set aside for them straight away. These two decide
          how long an order that nobody has confirmed keeps holding them.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Warn after"
            hint={times.warningMinutes === null ? "Not configured — no warning." : "Minutes."}
          >
            <input
              value={minutes(times.warningMinutes)}
              onChange={(event) => setTimes({ ...times, warningMinutes: toMinutes(event.target.value) })}
              onBlur={submit}
              disabled={!mayEdit || pending}
              inputMode="numeric"
              placeholder="Not configured"
              className={`${inputClass} tabular-nums`}
            />
          </Field>

          <Field
            label="Release stock after"
            hint={times.expiryMinutes === null ? "Not configured — nothing is ever released." : "Minutes. Must be the longer of the two."}
          >
            <input
              value={minutes(times.expiryMinutes)}
              onChange={(event) => setTimes({ ...times, expiryMinutes: toMinutes(event.target.value) })}
              onBlur={submit}
              disabled={!mayEdit || pending}
              inputMode="numeric"
              placeholder="Not configured"
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500">
          <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          {times.expiryMinutes === null
            ? "Nothing expires while this is empty. Stock is only released when an order is cancelled."
            : `An unconfirmed order releases its stock after ${times.expiryMinutes} minutes. Nothing runs this automatically yet.`}
        </p>
      </Card>

      {!mayEdit && (
        <Card className="p-4">
          <p className="text-sm font-medium text-slate-500">
            Shop settings are the Owner&rsquo;s to change.
          </p>
        </Card>
      )}
    </>
  );
}
