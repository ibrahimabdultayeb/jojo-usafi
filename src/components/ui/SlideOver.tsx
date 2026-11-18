"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";

/** Keeps the modal mounted through its exit. Native dialog provides focus trapping
 * and restores focus to the opener; page scroll stays locked until exit finishes. */
export function SlideOver({ open, onClose, label, closeLabel, narrow = false, children }: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  narrow?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const { reduced } = useShowroomMotion();
  const present = open || mounted;

  useLayoutEffect(() => {
    if (!present) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    // Focus the visible close control, rather than the non-tabbable backdrop.
    dialog.querySelector<HTMLButtonElement>(".slide-over-panel button")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      // React removes the dialog before this dependency cleanup runs, so the
      // browser may already have cleared its native focus restoration target.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [present]);

  useEffect(() => {
    if (!present) return;
    let first = 0;
    let second = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      setMounted(true);
      if (reduced) setEntered(true);
      else first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setEntered(true));
      });
    } else {
      setEntered(false);
      // Also handles a close before the opening transition started and browsers
      // which omit transitionend when the document is backgrounded.
      timeout = setTimeout(() => setMounted(false), reduced ? 0 : 400);
    }
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(timeout);
    };
  }, [open, present, reduced]);

  if (!present) return null;
  return (
    <dialog ref={dialogRef} className="slide-over" aria-label={label}
      data-entered={entered || undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button type="button" tabIndex={-1} className="slide-over-backdrop" aria-label={closeLabel} onClick={onClose} />
      <div className={`slide-over-panel${narrow ? " slide-over-panel-narrow" : ""}`}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === "transform" && !open) setMounted(false);
        }}>
        {children}
      </div>
    </dialog>
  );
}
