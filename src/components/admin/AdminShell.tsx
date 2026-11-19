"use client";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { can, ROLE_LABELS, type Role, type Capability } from "@/lib/admin/permissions";
import { signOutAction } from "@/app/(admin)/admin/sign-in/actions";
import { BranchedMenu, adminPathActive as isActive } from "./BranchedMenu";
import { Sheet } from "./ui";

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
function SignOutButton() {
  const { pending } = useFormStatus();
  return <button className="admin-signout" type="submit" aria-label="Sign out" disabled={pending} aria-busy={pending}>{pending ? <Spinner /> : <Icon name="logout" />}</button>;
}
export function AdminShell({ children, staff, newOrders = 0 }: { children: ReactNode; staff?: ShellStaff | null; newOrders?: number }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("jojo.admin.sidebar.collapsed") === "true"); } catch { /* Storage can be disabled. Navigation still works. */ }
  }, []);
  const role = staff?.role ?? "order_staff";
  const allowed = (items: NavItem[]) => items.filter(item => !item.capability || can(role, item.capability));
  const sections = useMemo(() => [
    {label:"Operations",items:OPERATIONS.filter(item => item.href !== "/admin")},
    {label:"Management",items:MANAGEMENT},
  ].map(section => ({...section,items:section.items.filter(item => !item.capability || can(role,item.capability)).map(item => ({...item,count:item.href === "/admin/orders" ? newOrders : undefined}))})).filter(section => section.items.length), [role,newOrders]);
  if (BARE_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) return <>{children}</>;
  const mobile = [...allowed(OPERATIONS).filter(item => !["/admin/inventory", "/admin/more/analytics"].includes(item.href)), {href:"/admin/more",label:"More",icon:"menu" as const}];
  const title = [...OPERATIONS, ...MANAGEMENT].filter(item => isActive(pathname, item.href)).at(-1)?.label ?? "More";
  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("jojo.admin.sidebar.collapsed", String(next)); } catch { /* Keep the in-memory preference. */ }
  };
  const overview = <Link href="/admin" className="admin-nav-overview" aria-current={pathname === "/admin" ? "page" : undefined} onClick={() => setMobileOpen(false)}><Icon name="dashboard"/><span>Overview</span></Link>;
  return <div className="admin-workspace" data-sidebar-collapsed={collapsed}>
    <a className="admin-skip" href="#admin-content">Skip to content</a>
    <aside className="admin-sidebar" aria-label="Workspace sidebar">
      <div className="admin-sidebar-top">
        <Link href="/admin" className="admin-brand" aria-label="Jojo Usafi admin"><Image src="/showroom/jojo-usafi.webp" alt="" width={40} height={40}/><span><strong>JOJO <b>USAFI</b></strong><small>STAFF WORKSPACE</small></span></Link>
        <button type="button" className="admin-sidebar-toggle" onClick={toggleSidebar} aria-expanded={!collapsed} aria-controls="admin-sidebar-navigation" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name={collapsed ? "panelExpand" : "panelCollapse"}/></button>
      </div>
      <nav id="admin-sidebar-navigation" aria-label="Admin navigation" className="admin-sidebar-nav">
        <div className="admin-expanded-navigation">{overview}<BranchedMenu sections={sections} pathname={pathname}/></div>
        <div className="admin-rail-navigation">{[...allowed(OPERATIONS),...allowed(MANAGEMENT)].map(item => <Link key={item.href} href={item.href} className="admin-rail-link" aria-label={item.label} title={item.label} aria-current={isActive(pathname,item.href)?"page":undefined}><Icon name={item.icon}/>{item.href === "/admin/orders" && newOrders > 0 && <b className="admin-rail-count">{newOrders > 99 ? "99+" : newOrders}</b>}</Link>)}</div>
      </nav>
      {staff && <div className="admin-staff"><Link href="/admin/more" className="admin-staff-profile" title={`${staff.name} · ${ROLE_LABELS[staff.role]}`} aria-label={`Account: ${staff.name}`}><span className="admin-avatar">{initialsOf(staff.name)}</span><span className="admin-staff-details"><strong>{staff.name}</strong><small>{ROLE_LABELS[staff.role]}</small></span></Link><form action={signOutAction}><SignOutButton/></form></div>}
    </aside>
    <div className="admin-main-column">
      <header className="admin-mobile-header"><button className="admin-mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Icon name="menu"/></button><strong>{title}</strong>{staff && <Link href="/admin/more" className="admin-avatar" aria-label={`Account: ${staff.name}`}>{initialsOf(staff.name)}</Link>}</header>
      <main id="admin-content" className="admin-content">{children}</main>
    </div>
    <nav className="admin-bottom-nav" aria-label="Mobile admin navigation">{mobile.map(item=><Link key={item.href} href={item.href} aria-current={isActive(pathname,item.href)?"page":undefined}><span><Icon name={item.icon}/>{item.href==="/admin/orders" && newOrders>0 && <b>{newOrders}</b>}</span>{item.label==="Overview"?"Home":item.label}</Link>)}</nav>
    <Sheet open={mobileOpen} title="Navigation" onClose={() => setMobileOpen(false)}><nav aria-label="All admin pages">{overview}<BranchedMenu sections={sections} pathname={pathname} onNavigate={() => setMobileOpen(false)}/></nav></Sheet>
  </div>;
}
export function AdminPage({title,subtitle,back,action,children}: {title:string;subtitle?:string;back?:{href:string;label:string};action?:ReactNode;children:ReactNode}) {
  return <div className="admin-page">{back && <Link href={back.href} className="admin-back"><Icon name="arrowLeft"/>{back.label}</Link>}<div className="admin-page-header"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</div>;
}
