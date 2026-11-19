"use client";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";
export function SubmitButton({ children, disabled, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending} className={`inline-flex items-center justify-center gap-2 ${className}`}>{pending && <Spinner/>}{children}</button>;
}
