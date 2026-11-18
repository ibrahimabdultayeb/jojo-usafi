import Image from "next/image";
import Link from "next/link";
import { AdminPage } from "@/components/admin/AdminShell";
import { OrderActions } from "./OrderActions";
import { Badge, Card } from "@/components/admin/ui";
import { formatTsh, whenExactly } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { orderTotals, STAGE_LABEL, STAGE_TONE, type AdminOrder, type TimelineEntry, type OrderStage } from "@/lib/admin/model";
import type { AmendableProduct } from "./AmendSheet";
import type { Role } from "@/lib/admin/permissions";
const PATH: OrderStage[] = ["new","awaiting_confirmation","confirmed","preparing","out_for_delivery","completed"];
export function OrderDetail({order,timeline,role,catalogue,images}: {order:AdminOrder;timeline:TimelineEntry[];role:Role;catalogue:AmendableProduct[];images:Record<string,string>}) {
  const totals = orderTotals(order);
  const current = PATH.indexOf(order.stage);
  const digits = order.customer.phone.replace(/[^0-9]/g,"").replace(/^0/,"255");
  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent(`Hello ${order.customer.name}, this is Jojo Usafi about your order ${order.number}.`)}`;
  const payment = order.payment.received;
  return <AdminPage title={order.number} subtitle={`Placed ${whenExactly(order.placed)} · ${payment?`Paid by ${payment.method.toLowerCase()}`:order.payment.preference}`} back={{href:"/admin/orders",label:"Orders"}} action={<Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge>}>
    {current>=0?<ol className="admin-card admin-order-steps" aria-label="Order progress">{PATH.map((stage,index)=><li key={stage} data-done={index<current} aria-current={stage===order.stage?"step":undefined}>{STAGE_LABEL[stage]}</li>)}</ol>:<div className="admin-exception"><strong>{STAGE_LABEL[order.stage]}</strong>{order.exceptionReason && <p>{order.exceptionReason}</p>}<p>{order.stockReservationReleased?"The stock reservation has been closed. See the activity below for the recorded stock outcome.":"Review the order history before arranging any further action."}</p></div>}
    <OrderActions order={order} role={role} catalogue={catalogue} details={<>
      <Card><div className="admin-card-heading"><h2>Items</h2><span>{totals.items} {totals.items===1?"item":"items"}</span></div><ul>{order.lines.map(item=><li key={item.sku} className="admin-line-item"><span className="admin-line-image">{images[item.sku]?<Image src={images[item.sku]} alt="" width={44} height={54}/>:<Icon name="package"/>}</span><div><strong>{item.name}</strong><small>{item.sku} · {item.size}</small></div><div className="admin-line-amount"><small>{item.quantity} × {formatTsh(item.unitPrice)}</small><strong>{formatTsh(item.quantity*item.unitPrice)}</strong></div></li>)}</ul><dl className="admin-detail-totals"><div><dt>Subtotal</dt><dd>{formatTsh(totals.subtotal)}</dd></div>{totals.discount>0 && <div><dt>Discount</dt><dd>−{formatTsh(totals.discount)}</dd></div>}<div><dt>Delivery · {order.delivery.zone}</dt><dd>{totals.delivery?formatTsh(totals.delivery):"Free"}</dd></div><div className="admin-total"><dt>{payment?"Order total":"Total due on delivery"}</dt><dd>{formatTsh(totals.total)}</dd></div>{payment && <div className="text-lime-700"><dt>Collected · {payment.method}</dt><dd>{formatTsh(payment.amount)}</dd></div>}</dl></Card>
      <Card><div className="admin-card-heading"><h2>Activity</h2></div>{timeline.length?<ol className="admin-timeline">{timeline.map((entry,i)=><li key={`${entry.at}-${i}`}><strong>{entry.label}</strong><p>{entry.by} · {whenExactly(entry.at)}</p></li>)}</ol>:<p className="admin-empty-copy">No activity recorded.</p>}</Card>
    </>} sidebar={<>
      <Card><div className="admin-card-heading"><h2>Customer & delivery</h2></div><div className="admin-customer-body"><dl><dt>Name</dt><dd><strong>{order.customer.id?<Link href={`/admin/customers/${order.customer.id}`}>{order.customer.name}</Link>:order.customer.name}</strong></dd><dt>Phone</dt><dd><a href={`tel:${order.customer.phone.replace(/\s/g,"")}`}>{order.customer.phone}</a></dd><dt>Zone</dt><dd>{order.delivery.zone}</dd><dt>Address</dt><dd>{order.delivery.address}</dd>{order.delivery.landmark && <><dt>Landmark</dt><dd>{order.delivery.landmark}</dd></>}{order.delivery.instructions && <><dt>Instructions</dt><dd>{order.delivery.instructions}</dd></>}</dl>{order.note && <p className="admin-customer-note"><strong>Customer note:</strong> {order.note}</p>}<div className="admin-contact-actions"><a href={waHref} target="_blank" rel="noopener noreferrer" className="admin-link-button admin-link-secondary"><WhatsAppIcon/>WhatsApp</a><a href={`tel:${order.customer.phone.replace(/\s/g,"")}`} className="admin-link-button admin-link-secondary"><Icon name="phone"/>Call customer</a></div></div></Card>
      <Card><div className="admin-card-heading"><h2>Payment</h2><Badge tone={payment?"good":"warn"}>{payment?"Paid":"Not paid yet"}</Badge></div><dl className="admin-detail-totals"><div><dt>Customer chose</dt><dd>{order.payment.preference}</dd></div>{payment && <><div><dt>Collected</dt><dd>{formatTsh(payment.amount)} · {payment.method}</dd></div>{payment.reference && <div><dt>Reference</dt><dd className="break-all">{payment.reference}</dd></div>}</>}</dl></Card>
      {order.staffNote && <Card><div className="admin-card-heading"><h2>Staff note</h2></div><p className="admin-empty-copy">{order.staffNote}</p></Card>}
    </>}/>
  </AdminPage>;
}
