"use client";
import Link from "@/components/ui/LoadingLink";
import GlideSelect from "@/components/ui/GlideSelect";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { AnimatedList } from "@/components/ui/AnimatedList";
import { useMemo, useState } from "react";
import { Badge, Card, EmptyState } from "@/components/admin/ui";
import { formatTsh, whenExactly } from "@/lib/admin/format";
import { formatPhoneE164 } from "@/lib/domain/phone";
import { Icon } from "@/components/ui/Icon";
import { orderTotals, NEXT_ACTION, STAGE_LABEL, STAGE_TONE, type AdminOrder, type OrderStage } from "@/lib/admin/model";

const FILTERS: {key:string;label:string;stages:OrderStage[]}[] = [
  {key:"all",label:"All",stages:[]},
  {key:"new",label:"New",stages:["new"]},
  {key:"awaiting_confirmation",label:"Awaiting confirmation",stages:["awaiting_confirmation"]},
  {key:"confirmed",label:"Confirmed",stages:["confirmed"]},
  {key:"preparing",label:"Preparing",stages:["preparing"]},
  {key:"out_for_delivery",label:"Out for delivery",stages:["out_for_delivery"]},
  {key:"completed",label:"Completed",stages:["completed"]},
  {key:"exceptions",label:"Exceptions",stages:["cancelled","delivery_failed"]},
];

function OrderCustomer({ order }: { order: AdminOrder }) {
  return <div className="admin-order-customer">
    <strong>{order.customer.name}</strong>
    <span className="admin-order-phone">{formatPhoneE164(order.customer.phone)}</span>
  </div>;
}

function OrderButton({ order }: { order: AdminOrder }) {
  const label = NEXT_ACTION[order.stage]?.label ?? "View order";
  return <Link href={`/admin/orders/${order.id}`} className="admin-order-open" aria-label={`${label} ${order.number}`}>
    <span>{label}</span>
  </Link>;
}

function paymentLabel(order: AdminOrder) {
  return order.payment.preference === "Cash on delivery" ? "Cash on delivery" : "Digital on delivery";
}

export function OrdersBrowser({orders,initialStage}: {orders:AdminOrder[];initialStage?:string}) {
  const [filter,setFilter] = useState(FILTERS.some(f=>f.key===initialStage)?initialStage!:initialStage==="delivery_failed"||initialStage==="cancelled"?initialStage:"all");
  const [term,setTerm] = useState("");
  const [zone,setZone] = useState("");
  const [sort,setSort] = useState("newest");
  const zones = useMemo(()=>Array.from(new Set(orders.map(o=>o.delivery.zone))).sort(),[orders]);
  const tabs = (filter==="delivery_failed"||filter==="cancelled")?[...FILTERS,{key:filter,label:STAGE_LABEL[filter],stages:[filter] as OrderStage[]}]:FILTERS;
  const visible = useMemo(()=>{
    const active = FILTERS.find(f=>f.key===filter);
    const stages = active?.stages ?? [filter];
    const q = term.trim().toLowerCase().replace(/\s/g,"");
    return orders.filter(o=>(!stages.length||stages.includes(o.stage))&&(!zone||o.delivery.zone===zone)&&(!q||[o.number,o.customer.name,o.customer.phone].some(field=>field.toLowerCase().replace(/\s/g,"").includes(q))))
      .sort((a,b)=>sort==="total"?orderTotals(b).total-orderTotals(a).total:sort==="oldest"?Date.parse(a.placed)-Date.parse(b.placed):Date.parse(b.placed)-Date.parse(a.placed));
  },[orders,filter,term,zone,sort]);
  const count = (stages:OrderStage[])=>stages.length?orders.filter(o=>stages.includes(o.stage)).length:orders.length;
  const hasFilters = filter!=="all"||term||zone||sort!=="newest";
  return <>
    <FilterTabs className="admin-order-status-tabs" label="Filter orders by status" value={filter} onChange={setFilter} items={tabs.map(tab=>({value:tab.key,label:tab.label,count:count(tab.stages)}))}/>
    <div className="admin-order-filters">

      <label className="admin-order-search"><Icon name="search"/><input type="search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Order number, customer or phone" aria-label="Search orders"/></label>
      <GlideSelect ariaLabel="Delivery zone" value={zone} onChange={setZone} options={[{value:"",label:"All zones"},...zones.map(value=>({value,label:value}))]}/>
      <GlideSelect ariaLabel="Sort orders" value={sort} onChange={setSort} options={[{value:"newest",label:"Newest first"},{value:"oldest",label:"Oldest first"},{value:"total",label:"Highest total"}]}/>
      {hasFilters && <button type="button" onClick={()=>{setFilter("all");setTerm("");setZone("");setSort("newest");}}>Clear filters</button>}
    </div>
    <p className="admin-result-count" role="status">{visible.length} of {orders.length} orders</p>
    {!visible.length?<EmptyState fillPage title="No orders match" body="Try another status, zone or search term."/>:<>
      <Card className="admin-orders-table-wrap">
        <table className="admin-orders-table">
          <caption className="sr-only">Orders with customer contact details, delivery zones, totals and next steps</caption>
          <thead><tr>{["Order / placed", "Customer", "Delivery zone", "Total / payment", "Status", "Next step"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <AnimatedList as="tbody" resetKey={`${filter}:${term}:${zone}:${sort}`}>
            {visible.map(order => {
              const totals = orderTotals(order);
              return <tr key={order.id}>
                <td>
                  <Link className="admin-order-number" href={`/admin/orders/${order.id}`}>{order.number}</Link>
                  <time className="admin-order-placed" dateTime={order.placed}>{whenExactly(order.placed)}</time>
                </td>
                <td><OrderCustomer order={order}/></td>
                <td>{order.delivery.zone}</td>
                <td>
                  <strong className="admin-order-total">{formatTsh(totals.total)}</strong>
                  <span className="admin-order-meta">{totals.items} {totals.items === 1 ? "item" : "items"}</span>
                  <span className="admin-order-meta">{paymentLabel(order)}</span>
                </td>
                <td><Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge></td>
                <td><OrderButton order={order}/></td>
              </tr>;
            })}
          </AnimatedList>
        </table>
      </Card>
      <AnimatedList as="ul" className="admin-order-cards" label="Orders" resetKey={`${filter}:${term}:${zone}:${sort}`}>
        {visible.map(order => {
          const totals = orderTotals(order);
          return <li key={order.id}>
            <Card className="admin-order-card">
              <div className="admin-order-card-heading">
                <Link className="admin-order-number" href={`/admin/orders/${order.id}`}>{order.number}</Link>
                <Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge>
              </div>
              <OrderCustomer order={order}/>
              <dl className="admin-order-facts">
                <div><dt>Placed</dt><dd><time dateTime={order.placed}>{whenExactly(order.placed)}</time></dd></div>
                <div><dt>Delivery zone</dt><dd>{order.delivery.zone}</dd></div>
                <div><dt>Items</dt><dd>{totals.items} {totals.items === 1 ? "item" : "items"}</dd></div>
                <div><dt>Payment</dt><dd>{paymentLabel(order)}</dd></div>
              </dl>
              <div className="admin-order-card-footer">
                <div><span className="admin-order-meta">Order total</span><strong className="admin-order-total">{formatTsh(totals.total)}</strong></div>
                <OrderButton order={order}/>
              </div>
            </Card>
          </li>;
        })}
      </AnimatedList>
    </>}
  </>;
}
