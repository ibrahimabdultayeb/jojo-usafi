import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/admin/orders/OrderDetail";
import { getAdminOrder, getAmendableProducts, getOrderTimeline } from "@/lib/admin/orders";
import { currentStaff } from "@/lib/admin/authorize";
import { getAdminCatalogue } from "@/lib/catalogue/admin";
export async function generateMetadata({params}: {params:Promise<{id:string}>}) {
  const {id}=await params;
  const order=await getAdminOrder(id);
  return {title:order?order.number:"Order"};
}
export default async function AdminOrderPage({params}: {params:Promise<{id:string}>}) {
  const {id}=await params;
  const order=await getAdminOrder(id);
  if (!order) notFound();
  const amendable=["new","awaiting_confirmation","confirmed","preparing"].includes(order.stage);
  const [timeline,staff,catalogue,products]=await Promise.all([getOrderTimeline(id),currentStaff(),amendable?getAmendableProducts():[],getAdminCatalogue()]);
  const images=Object.fromEntries(products.products.filter(p=>p.imageUrl && order.lines.some(line=>line.sku===p.sku)).map(p=>[p.sku,p.imageUrl!]));
  return <OrderDetail order={order} timeline={timeline} role={staff?.role??"order_staff"} catalogue={catalogue} images={images}/>;
}
