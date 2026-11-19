import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import "./auth.css";

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
            <Image src="/showroom/jojo-usafi-wordmark.svg" alt="" width={575} height={385} className="admin-auth-watermark" priority aria-hidden="true" />
            <div className="admin-auth-brand-top">
              <Link href="/" className="admin-auth-logo" aria-label="Jojo Usafi storefront">
                <Image src="/showroom/jojo-usafi.webp" alt="" width={52} height={52} priority />
                <span>JOJO <span>USAFI</span></span>
              </Link>
              <p className="admin-auth-brand-caption">Shop management · Staff workspace</p>
            </div>
            <div className="admin-auth-pitch">
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
