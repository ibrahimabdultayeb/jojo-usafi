import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import "./auth.css";

function Globe({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {/* Heroicons globe-europe-africa, MIT — see THIRD_PARTY_NOTICES.md. */}
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM8.547 4.505a8.25 8.25 0 1 0 11.672 8.214l-.46-.46a2.252 2.252 0 0 1-.422-.586l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.211.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.654-.261a2.25 2.25 0 0 1-1.384-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236a1.125 1.125 0 0 0 1.302-.795l.208-.73a1.125 1.125 0 0 0-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 0 1-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 0 1-1.458-1.137l1.279-2.132Z" />
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
            <Image src="/showroom/jojo-usafi-wordmark.svg" alt="" width={575} height={385} className="admin-auth-watermark" priority aria-hidden="true" />
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
