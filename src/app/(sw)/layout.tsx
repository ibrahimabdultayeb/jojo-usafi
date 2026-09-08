import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StorefrontLayout, storefrontMetadata } from "@/views/StorefrontLayout";

export { viewport } from "@/views/StorefrontLayout";

export const metadata: Metadata = storefrontMetadata("sw");

/** Root layout for the Kiswahili storefront. */
export default function KiswahiliRootLayout({ children }: { children: ReactNode }) {
  return <StorefrontLayout locale="sw">{children}</StorefrontLayout>;
}
