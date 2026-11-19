import { AnimatedList } from "@/components/ui/AnimatedList";
import Link from "@/components/ui/LoadingLink";
import { AdminPage } from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import { getRecentActivity, getRecentStockActivity } from "@/lib/admin/orders";
import { currentStaff } from "@/lib/admin/authorize";
import { can } from "@/lib/admin/permissions";
import { whenExactly } from "@/lib/admin/format";
export const metadata={title:"Activity log"};
export default async function ActivityPage(){
 const staff=await currentStaff();
 const [orders,stock]=await Promise.all([getRecentActivity(50),staff&&can(staff.role,"products.view")?getRecentStockActivity(50):[]]);
 const rows=[...orders.map(e=>({...e,key:`order-${e.at}-${e.text}`})),...stock.map(e=>({key:e.id,at:e.at,text:`${e.name} · ${e.reason} · ${e.delta>0?"+":""}${e.delta} on hand, ${e.reservedDelta>0?"+":""}${e.reservedDelta} reserved`,by:e.by,href:`/admin/products/${encodeURIComponent(e.sku)}`}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,50);
 return <AdminPage title="Activity log" subtitle="The latest 50 recorded order and stock events."><Card>{rows.length?<AnimatedList as="ol" className="admin-timeline">{rows.map(e=><li key={e.key}><Link href={e.href??"/admin/orders"}><strong>{e.text}</strong></Link><p>{e.by} · {whenExactly(e.at)}</p></li>)}</AnimatedList>:<p className="admin-empty-copy">No activity recorded yet.</p>}</Card></AdminPage>;
}
