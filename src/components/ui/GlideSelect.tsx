"use client";

// Adapted from React Bits Glide Select by David Haz. See THIRD_PARTY_NOTICES.md.
// Keeps the corner pop and gliding highlight; adds form validation, scrollable
// options and a viewport-positioned portal so menus cannot be clipped by cards.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import "./GlideSelect.css";

export interface GlideSelectOption { value: string; label: ReactNode; textValue?: string; disabled?: boolean; tag?: string }
interface Props {
  options: GlideSelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
}
const textOf = (option: GlideSelectOption) => option.textValue ?? (typeof option.label === "string" ? option.label : option.value);

export default function GlideSelect({ options, value, onChange, ariaLabel, id, name, required, disabled, busy, placeholder = "Select…", className = "", "aria-describedby": describedBy }: Props) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typed = useRef({ text: "", at: 0 });
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [active, setActive] = useState(-1);
  const [invalid, setInvalid] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  const selected = options.findIndex(option => option.value === value);
  const blocked = disabled || busy;
  const optionsKey = options.map(option => `${option.value}:${!!option.disabled}`).join("|");

  const close = useCallback((immediate = false) => {
    if (phase === "closed") return;
    clearTimeout(closeTimer.current);
    setPhase(immediate ? "closed" : "closing");
    if (!immediate) closeTimer.current = setTimeout(() => setPhase("closed"), 130);
  }, [phase]);
  function open(last = false) {
    if (blocked || !options.length) return;
    clearTimeout(closeTimer.current);
    const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
    setActive(selected >= 0 && !options[selected].disabled ? selected : (last ? enabled.at(-1) : enabled[0]) ?? -1);
    setPhase("open");
  }
  function pick(index: number) {
    const option = options[index];
    if (!option || option.disabled || blocked) return;
    setInvalid(false);
    close();
    trigger.current?.focus({ preventScroll: true });
    if (option.value !== value) onChange(option.value);
  }

  useLayoutEffect(() => {
    if (phase === "closed") return;
    const place = () => {
      const button = trigger.current;
      if (!button || !root.current) return;
      const rect = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = document.documentElement.clientWidth;
      const below = viewportTop + viewportHeight - rect.bottom - 14;
      const above = rect.top - viewportTop - 14;
      const desired = Math.min(320, options.length * 45 + 10);
      const onTop = below < desired && above > below;
      const height = Math.min(desired, Math.max(72, onTop ? above : below));
      const width = Math.min(Math.max(rect.width, 224), viewportWidth - 24);
      const styles = getComputedStyle(root.current);
      setPosition({
        left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)),
        top: onTop ? Math.max(viewportTop + 8, rect.top - height - 6) : rect.bottom + 6,
        width, maxHeight: height,
        "--gs-origin": onTop ? "bottom left" : "top left",
        ...Object.fromEntries(["surface", "highlight", "text", "muted", "accent", "border"].map(key => [`--gs-${key}`, styles.getPropertyValue(`--gs-${key}`)])),
      } as CSSProperties);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    if (trigger.current) observer.observe(trigger.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [phase, options.length]);

  useLayoutEffect(() => {
    if (phase !== "open") return;
    const viewport = list.current;
    const option = viewport?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    const pill = viewport?.querySelector<HTMLElement>(".glide-select__pill");
    if (!option || !viewport || !pill) return;
    pill.style.transform = `translateY(${option.offsetTop}px)`;
    pill.style.height = `${option.offsetHeight}px`;
    pill.style.opacity = "1";
    if (option.offsetTop < viewport.scrollTop) viewport.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = option.offsetTop + option.offsetHeight - viewport.clientHeight;
  }, [active, phase, optionsKey, position.maxHeight]);

  useEffect(() => {
    if (phase === "closed") return;
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) close();
    }
    function blur(event: FocusEvent) {
      if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", blur);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", blur); };
  }, [phase, close]);
  useEffect(() => { if (blocked) close(true); }, [blocked, close]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (blocked) return;
    if (key === "Escape" && phase === "open") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (key === "Escape" && phase === "closing") { close(true); return; }
    if (key === "Tab") { close(); return; }
    if (phase !== "open" && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(key)) {
      event.preventDefault(); open(key === "ArrowUp"); return;
    }
    if (phase === "open" && (key === "Enter" || key === " ")) { event.preventDefault(); pick(active); return; }
    const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      const i = enabled.indexOf(active);
      setActive(key === "Home" ? enabled[0] : key === "End" ? enabled.at(-1)! : enabled[Math.min(enabled.length - 1, Math.max(0, i + (key === "ArrowDown" ? 1 : -1)))]);
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      typed.current.text = now - typed.current.at < 600 ? typed.current.text + key.toLowerCase() : key.toLowerCase();
      typed.current.at = now;
      const match = enabled.find(index => textOf(options[index]).toLowerCase().startsWith(typed.current.text));
      if (match !== undefined) { if (phase !== "open") open(); setActive(match); }
    }
  }

  return <div ref={root} className={`glide-select ${className}`} data-disabled={blocked || undefined}>
    <button ref={trigger} id={triggerId} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={phase === "open"}
      aria-controls={phase !== "closed" ? listId : undefined} aria-activedescendant={phase === "open" && active >= 0 ? `${listId}-${active}` : undefined}
      aria-label={ariaLabel} aria-describedby={describedBy} aria-required={required || undefined} aria-invalid={invalid || undefined} aria-busy={busy || undefined}
      disabled={blocked} className="glide-select__trigger" onClick={() => phase === "open" ? close() : open()} onKeyDown={onKeyDown}>
      <span className="glide-select__label" key={value}>{selected >= 0 ? options[selected].label : placeholder}</span>
      {busy ? <Spinner/> : <Icon name="chevronDown" className="glide-select__chevron"/>}
    </button>
    {(name || required) && <select className="glide-select__native" name={name} value={value} required={required} disabled={blocked} tabIndex={-1} aria-hidden="true"
      onChange={event => { setInvalid(false); onChange(event.target.value); }} onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); open(); }}>
      {!options.some(option => option.value === "") && <option value=""/>}
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{textOf(option)}</option>)}
    </select>}
    {phase !== "closed" && typeof document !== "undefined" && createPortal(
      <div ref={menu} className="glide-select__menu" data-state={phase} style={position} onPointerDown={event => { if (event.pointerType !== "touch") event.preventDefault(); }}>
        <div ref={list} id={listId} role="listbox" aria-label={ariaLabel} className="glide-select__list">
          <span className="glide-select__pill" aria-hidden="true"/>
          {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={value === option.value} aria-disabled={option.disabled || undefined}
            data-index={index} className="glide-select__option" onPointerMove={event => { if (event.pointerType !== "touch" && !option.disabled) setActive(index); }} onClick={() => pick(index)}>
            <span className="glide-select__name">{option.label}</span>{option.tag && <span className="glide-select__tag">{option.tag}</span>}
            <Icon name="check" className={`glide-select__check ${value === option.value ? "" : "invisible"}`}/>
          </div>)}
        </div>
      </div>, document.body)}
  </div>;
}
