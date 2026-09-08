import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "@/app/globals.css";

import { AdminShell } from "@/components/admin/AdminShell";
import { RoleProvider } from "@/components/admin/RoleContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Jojo Usafi Admin", template: "%s · Jojo Usafi Admin" },
  description: "Run the shop: orders, products, customers and delivery.",
  // The admin is staff-only and must never appear in a search result.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

/**
 * Root layout for the admin.
 *
 * The admin is its own root layout, separate from the two storefront ones, so it
 * carries none of the shop chrome — no announcement bar, no cart, no language
 * chooser — and cannot accidentally inherit them.
 *
 * The admin is English-first in V1. `<html lang="en">` is honest about that;
 * `src/lib/admin/copy.ts` is the seam where a second language goes.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-slate-100 font-sans antialiased">
        <RoleProvider>
          <AdminShell>{children}</AdminShell>
        </RoleProvider>
      </body>
    </html>
  );
}
