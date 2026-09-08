import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "../../globals.css";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * The admin dashboard's own root layout.
 *
 * Admin sits outside the localized route tree — it is English-first in V1 (see
 * docs/DECISIONS.md) — so `src/middleware.ts` skips `/admin` and it never
 * becomes `/en/admin`. It shares the storefront's fonts and design tokens, but
 * not its header, footer or WhatsApp button.
 */

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Jojo Usafi admin", template: "%s · Jojo Usafi admin" },
  // The shop's back office is never indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-slate-50 font-sans antialiased">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
