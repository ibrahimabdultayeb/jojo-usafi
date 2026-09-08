import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StorefrontLayout, storefrontMetadata } from "@/views/StorefrontLayout";

export { viewport } from "@/views/StorefrontLayout";

export const metadata: Metadata = storefrontMetadata("en");

/** Root layout for the English storefront. */
export default function EnglishRootLayout({ children }: { children: ReactNode }) {
  return <StorefrontLayout locale="en">{children}</StorefrontLayout>;
}
