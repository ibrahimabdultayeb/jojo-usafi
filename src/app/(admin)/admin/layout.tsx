import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "../../globals.css";
import { AdminShell } from "@/components/admin/AdminShell";
import { currentStaff } from "@/lib/admin/authorize";

/**
 * The admin dashboard's own root layout.
 *
 * Admin sits outside the localized route tree — it is English-first in V1 (see
 * docs/DECISIONS.md) — so it never becomes `/en/admin`. It shares the
 * storefront's fonts and design tokens, but not its header, footer or WhatsApp
 * button.
 *
 * `src/middleware.ts` matches `/admin` only, refreshes the Supabase session
 * cookies so a signed-in staff member is not quietly logged out mid-shift, and
 * sends anybody who is not signed in to `/admin/sign-in`. It is not the
 * authorization boundary — Row Level Security is, and every write additionally
 * passes `authorize()` first.
 *
 * The identity in the frame is read here, once, and passed down: the shell is a
 * client component and must not be able to ask the database who it is.
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-slate-50 font-sans antialiased">
        <AdminShell staff={staff && { name: staff.name, role: staff.role }}>{children}</AdminShell>
      </body>
    </html>
  );
}
