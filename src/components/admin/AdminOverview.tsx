import Link from "next/link";
import { Badge, Card } from "./ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { can, type Role } from "@/lib/admin/permissions";
import { formatTsh, whenExactly } from "@/lib/admin/format";
import { STAGE_LABEL, STAGE_TONE } from "@/lib/admin/model";
import type { AdminSnapshot, StockActivityEntry } from "@/lib/admin/orders";

export interface OverviewProps {
  name: string; role: Role; snapshot: AdminSnapshot; lowStock: number; outOfStock: number; missingImages: number; stockActivity: StockActivityEntry[]; now: string;
}
export function AdminOverview({name,role,snapshot,lowStock,outOfStock,missingImages,stockActivity,now}: OverviewProps) {
  const date = new Date(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Dar_es_Salaam",hour:"numeric",hourCycle:"h23"}).format(date));
  const greeting = hour<12?"morning":hour<17?"afternoon":"evening";
  const count = snapshot.counts;
  const showProducts = can(role,"products.view");
  const summary = [
    {label:"New orders",value:count.new,dot:"#1e5fd0",href:"/admin/orders?stage=new"},
    {label:"Awaiting confirmation",value:count.awaiting_confirmation,dot:"#c28a16",href:"/admin/orders?stage=awaiting_confirmation"},
    {label:"Being prepared",value:count.preparing,dot:"#7c58bc",href:"/admin/orders?stage=preparing"},
    {label:"Out for delivery",value:count.out_for_delivery,dot:"#16869a",href:"/admin/orders?stage=out_for_delivery"},
    {label:"Need attention",value:count.delivery_failed,dot:"#c74b48",href:"/admin/orders?stage=delivery_failed"},
    ...(showProducts?[{label:"Low stock",value:lowStock,dot:"#c28a16",href:"/admin/products?filter=low-stock"}]:[]),
  ];
  const attention: {title:string;detail:string;count:number;href:string;cta:string;icon:IconName}[] = [
    {title:"New orders to review",detail:"Check the items and contact the customer to confirm.",count:count.new,href:"/admin/orders?stage=new",cta:"Review",icon:"bag" as const},
    {title:"Waiting for confirmation",detail:"Follow up with customers who have not confirmed yet.",count:count.awaiting_confirmation,href:"/admin/orders?stage=awaiting_confirmation",cta:"Follow up",icon:"phone" as const},
    {title:"Confirmed orders to prepare",detail:"These orders are ready to be picked and packed.",count:count.confirmed,href:"/admin/orders?stage=confirmed",cta:"Prepare",icon:"package" as const},
    {title:"Deliveries need attention",detail:"Review what happened and the recorded stock outcome.",count:count.delivery_failed,href:"/admin/orders?stage=delivery_failed",cta:"Review",icon:"truck" as const},
    ...(showProducts?[
      {title:"Products running low",detail:"Check available quantities and arrange replenishment.",count:lowStock,href:"/admin/products?filter=low-stock",cta:"View stock",icon:"store" as const},
      {title:"Products out of stock",detail:"These products cannot currently be ordered.",count:outOfStock,href:"/admin/products?filter=out-of-stock",cta:"View stock",icon:"package" as const},
      {title:"Products missing images",detail:"Add an approved photograph before showing them in the shop.",count:missingImages,href:"/admin/products?filter=missing-image",cta:"Review",icon:"image" as const},
    ]:[]),
  ].filter(item=>item.count>0);
  return <div className="admin-page">
    <div className="admin-overview-header"><div><p>{date.toLocaleDateString("en-GB",{timeZone:"Africa/Dar_es_Salaam",weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p><h1>Good {greeting}{name?`, ${name.trim().split(/\s+/)[0]}`:""}</h1></div><Link href="/admin/orders?stage=new" className="admin-link-button"><Icon name="bag"/>Open new orders</Link></div>
    <div className="admin-summary">{summary.map(item=><Link key={item.label} href={item.href}><span><i style={{background:item.dot}}/>{item.label}</span><strong>{item.value}</strong></Link>)}</div>
    <div className="admin-overview-grid">
      <Card><div className="admin-card-heading"><h2>Needs your attention</h2><span>{attention.length} {attention.length===1?"area":"areas"}</span></div>{attention.length?attention.map(item=><div className="admin-attention-row" key={item.title}><span className="admin-attention-icon"><Icon name={item.icon}/></span><div><strong>{item.count} · {item.title}</strong><p>{item.detail}</p></div><Link href={item.href}>{item.cta}</Link></div>):<p className="admin-empty-copy">All clear. No orders need attention right now.</p>}</Card>
      <div className="admin-stack">
        {can(role,"analytics.view") && <Card className="admin-sales"><h2>Collected today</h2><strong>{formatTsh(snapshot.todaySalesTzs)}</strong><p>Payments collected today in Dar es Salaam. Excludes unpaid and cancelled orders.</p><div><span>Cash · {formatTsh(snapshot.cashTzs)}</span><span>Digital · {formatTsh(snapshot.digitalTzs)}</span></div></Card>}
        <Card><div className="admin-card-heading"><h2>Recent orders</h2><Link href="/admin/orders">All orders</Link></div>{snapshot.recent.length?snapshot.recent.map(order=><Link className="admin-recent-row" key={order.id} href={`/admin/orders/${order.id}`}><strong>{order.number}</strong><span>{order.customer.name}</span><Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge></Link>):<p className="admin-empty-copy">Orders will appear here when customers place them.</p>}</Card>
        {showProducts && <Card><div className="admin-card-heading"><h2>Recent stock activity</h2><Link href="/admin/inventory">View stock</Link></div>{stockActivity.length?stockActivity.map(entry=><div className="admin-stock-row" key={entry.id}><strong className={entry.delta>0?"text-lime-700":"text-slate-600"}>{entry.delta===0?`${entry.reservedDelta>0?"+":""}${entry.reservedDelta} reserved`:`${entry.delta>0?"+":""}${entry.delta}`}</strong><span>{entry.name}<small>{entry.reason} · {entry.by}</small><small>{whenExactly(entry.at)}</small></span></div>):<p className="admin-empty-copy">No stock movements recorded yet.</p>}</Card>}
      </div>
    </div>
  </div>;
}
