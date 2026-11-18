import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import "./auth.css";

function Globe({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="m18 7 5 3 1 7 7 1 4 6-4 5-8-1-2 6 5 6-1 8-6 7-2-9-5-6-2-9-6-3 2-11 6-7Zm22-1 5 3-2 6-6 1-2 5 6 6 8-1 4 6-5 5-2 11-6 6-3-7-1-9-6-7 3-8 1-7Zm14 36 6 1-3 8-5 3-3-4Z" />
    </svg>
  );
}

/** Shared visual shell for signing in and recovering access. */
export function AuthPanel({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="admin-auth">
      <div className="admin-auth-wrap">
        <div className="admin-auth-card">
          <aside className="admin-auth-brand" aria-label="Jojo Usafi staff workspace">
            <Globe className="admin-auth-watermark" />
            <div className="admin-auth-brand-top">
              <Link href="/" className="admin-auth-logo" aria-label="Jojo Usafi storefront">
                <Image src="/showroom/jojo-usafi.webp" alt="" width={52} height={52} priority />
                <span>JOJO <span>USAFI</span></span>
              </Link>
              <p className="admin-auth-brand-caption">Shop management · Staff workspace</p>
            </div>
            <div className="admin-auth-pitch">
              <Globe className="admin-auth-globe" />
              <h2>One place for<br /><span>your whole shop.</span></h2>
              <p>Orders, products, stock and customers,<br className="admin-auth-desktop-break" /> together in one workspace.</p>
            </div>
            <p className="admin-auth-trust"><Icon name="shield" /> Authorised staff access</p>
          </aside>
          <section className="admin-auth-content" aria-labelledby="admin-auth-title">
            <div className="admin-auth-lock" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
              </svg>
            </div>
            <h1 id="admin-auth-title">{title}</h1>
            {subtitle && <p className="admin-auth-subtitle">{subtitle}</p>}
            <div className="admin-auth-body">{children}</div>
          </section>
        </div>
        <p className="admin-auth-copyright">© {new Date().getFullYear()} Jojo Usafi · Staff workspace</p>
      </div>
    </main>
  );
}
