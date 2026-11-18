"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { can, ROLE_LABELS, type Role, type Capability } from "@/lib/admin/permissions";
import { signOutAction } from "@/app/(admin)/admin/sign-in/actions";

interface NavItem { href: string; label: string; icon: IconName; capability?: Capability }
const OPERATIONS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: "bag", capability: "orders.view" },
  { href: "/admin/products", label: "Products", icon: "package", capability: "products.view" },
  { href: "/admin/inventory", label: "Inventory", icon: "store", capability: "products.view" },
  { href: "/admin/customers", label: "Customers", icon: "users", capability: "customers.view" },
  { href: "/admin/more/analytics", label: "Reports", icon: "chart", capability: "analytics.view" },
];
const MANAGEMENT: NavItem[] = [
  { href: "/admin/more/delivery-zones", label: "Delivery zones", icon: "mapPin", capability: "delivery.manage" },
  { href: "/admin/more/catalogue-sync", label: "Catalogue sync", icon: "sync", capability: "catalogue.sync" },
  { href: "/admin/more/media", label: "Media library", icon: "image", capability: "products.view" },
  { href: "/admin/more/staff", label: "Team & permissions", icon: "shield", capability: "staff.manage" },
  { href: "/admin/more/settings", label: "Store settings", icon: "settings", capability: "settings.manage" },
  { href: "/admin/more/activity", label: "Activity log", icon: "clock", capability: "orders.view" },
  { href: "/admin/more/website", label: "Website", icon: "house", capability: "website.manage" },
];
const BARE_ROUTES = ["/admin/sign-in", "/admin/setup", "/admin/forgot-password", "/admin/set-password"];
export interface ShellStaff { name: string; role: Role }
function initialsOf(name: string) { return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase(); }
function isActive(path: string, href: string) { return href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`); }
function SignOutButton() {
  const { pending } = useFormStatus();
  return <button className="admin-signout" type="submit" aria-label="Sign out" disabled={pending} aria-busy={pending}>{pending ? <Spinner /> : <Icon name="logout" />}</button>;
}
export function AdminShell({ children, staff, newOrders = 0 }: { children: ReactNode; staff?: ShellStaff | null; newOrders?: number }) {
  const pathname = usePathname();
  if (BARE_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) return <>{children}</>;
  const role = staff?.role ?? "order_staff";
  const allowed = (items: NavItem[]) => items.filter(item => !item.capability || can(role, item.capability));
  const mobile = [...allowed(OPERATIONS).filter(item => !["/admin/inventory", "/admin/more/analytics"].includes(item.href)), {href:"/admin/more",label:"More",icon:"menu" as const}];
  const title = [...OPERATIONS, ...MANAGEMENT].filter(item => isActive(pathname, item.href)).at(-1)?.label ?? "More";
  return <div className="admin-workspace">
    <a className="admin-skip" href="#admin-content">Skip to content</a>
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand"><Image src="/showroom/jojo-usafi.webp" alt="" width={36} height={36}/><span><strong>JOJO <b>USAFI</b></strong><small>ADMIN</small></span></Link>
      <nav aria-label="Admin navigation" className="admin-sidebar-nav">
        {[{label:"OPERATIONS",items:allowed(OPERATIONS)},{label:"MANAGEMENT",items:allowed(MANAGEMENT)}].filter(g=>g.items.length).map(group=><div className="admin-nav-group" key={group.label}>
          <p>{group.label}</p>{group.items.map(item=><Link key={item.href} href={item.href} className="admin-nav-link" aria-current={isActive(pathname,item.href)?"page":undefined}><Icon name={item.icon}/><span>{item.label}</span>{item.href==="/admin/orders" && newOrders>0 && <b className="admin-nav-count">{newOrders}</b>}</Link>)}
        </div>)}
      </nav>
      {staff && <div className="admin-staff"><span className="admin-avatar">{initialsOf(staff.name)}</span><Link href="/admin/more"><strong>{staff.name}</strong><small>{ROLE_LABELS[staff.role]}</small></Link><form action={signOutAction}><SignOutButton/></form></div>}
    </aside>
    <div className="admin-main-column">
      <header className="admin-mobile-header"><Image src="/showroom/jojo-usafi.webp" alt="" width={32} height={32}/><strong>{title}</strong>{staff && <Link href="/admin/more" className="admin-avatar" aria-label={`Account: ${staff.name}`}>{initialsOf(staff.name)}</Link>}</header>
      <main id="admin-content" className="admin-content">{children}</main>
    </div>
    <nav className="admin-bottom-nav" aria-label="Mobile admin navigation">{mobile.map(item=><Link key={item.href} href={item.href} aria-current={isActive(pathname,item.href)?"page":undefined}><span><Icon name={item.icon}/>{item.href==="/admin/orders" && newOrders>0 && <b>{newOrders}</b>}</span>{item.label==="Overview"?"Home":item.label}</Link>)}</nav>
  </div>;
}
export function AdminPage({title,subtitle,back,action,children}: {title:string;subtitle?:string;back?:{href:string;label:string};action?:ReactNode;children:ReactNode}) {
  return <div className="admin-page">{back && <Link href={back.href} className="admin-back"><Icon name="arrowLeft"/>{back.label}</Link>}<div className="admin-page-header"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</div>;
}
