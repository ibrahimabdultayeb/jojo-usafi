"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, SectionTitle } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { can, type Role } from "@/lib/admin/permissions";
import {
  removeProductImageAction,
  uploadProductImageAction,
  type MediaResult,
} from "@/lib/admin/media-actions";

/**
 * The product's photograph, and how it is changed.
 *
 * Built around the one fact that matters operationally: **106 of the 201
 * products are held off the website for want of a photograph**, so this screen
 * is where most of the remaining catalogue work happens. It is therefore
 * phone-first and says plainly what the picture is doing — on the website, or
 * the reason it is not.
 *
 * The file is chosen with a plain `<input type="file">` behind a big button,
 * because the native picker is the one part of this a phone already does well.
 * Nothing is uploaded until a file is chosen, and nothing is stored until the
 * server has read the bytes and agreed they are a product photograph.
 *
 * There is no crop tool and no editor. The rules live in `src/lib/admin/media.ts`
 * and the screen's job is to say which one a rejected picture broke.
 */
export function ProductPhoto({
  sku,
  name,
  image,
  isPublic,
  blockedReason,
  role,
}: {
  sku: string;
  name: string;
  image: { src: string; width: number; height: number } | null;
  isPublic: boolean;
  blockedReason: string | null;
  role: Role;
}) {
  const router = useRouter();
  const chooser = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MediaResult | null>(null);

  const mayEdit = can(role, "products.editVisibility");

  function run(operation: () => Promise<MediaResult>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await operation();
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  function chosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clearing the input matters: choosing the same file twice in a row after a
    // refusal would otherwise fire no change event at all.
    event.target.value = "";
    if (!file) return;

    const form = new FormData();
    form.set("file", file);
    run(() => uploadProductImageAction(sku, form));
  }

  return (
    <>
      <SectionTitle>Photograph</SectionTitle>
      <Card className="mb-5 p-4">
        <div className="flex items-start gap-4">
          <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {image ? (
              <Image src={image.src} alt={name} fill sizes="96px" className="object-contain" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
                <Icon name="package" className="h-6 w-6" />
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            {image ? (
              <>
                <p className="text-sm font-bold text-slate-900">
                  {isPublic ? "On the website" : "Not on the website"}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {isPublic
                    ? "Shoppers can see and buy this."
                    : blockedReason || "Something other than the picture is holding it back."}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-amber-900">No photograph yet</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  A product cannot go on the website without one, however everything else is set.
                </p>
              </>
            )}

            <p className="mt-2 text-[11px] font-medium text-slate-400">
              WebP, PNG or JPEG · at least 600px · close to square · up to 8MB
            </p>
          </div>
        </div>

        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
              result.ok ? "bg-brand-50 text-brand-900" : "bg-amber-50 text-amber-900"
            }`}
          >
            {result.message}
          </p>
        )}

        {mayEdit ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              ref={chooser}
              type="file"
              accept="image/webp,image/png,image/jpeg"
              onChange={chosen}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <Button
              variant="accent"
              icon="plus"
              full
              disabled={pending}
              onClick={() => chooser.current?.click()}
            >
              {pending ? "Working…" : image ? "Replace the photograph" : "Add a photograph"}
            </Button>

            {image && (
              <Button
                variant="danger"
                icon="trash"
                full
                disabled={pending}
                onClick={() => run(() => removeProductImageAction(sku))}
              >
                Take it off
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-slate-500">
            Photographs are looked after by the Owner and Managers.
          </p>
        )}
      </Card>
    </>
  );
}
