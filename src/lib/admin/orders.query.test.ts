import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const store=vi.hoisted(()=>({rows:[] as Record<string,unknown>[],fail:false}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/server",()=>({getServerSupabase:async()=>({from:()=>{
 let columns="",head=false,from=0,to=Infinity;
 const filters:((row:Record<string,unknown>)=>boolean)[]=[];
 const query={
  select(value:string,options?:{head?:boolean}){columns=value;head=!!options?.head;return query;},
  eq(key:string,value:unknown){filters.push(row=>row[key]===value);return query;},
  gte(key:string,value:string){filters.push(row=>String(row[key])>=value);return query;},
  lt(key:string,value:string){filters.push(row=>String(row[key])<value);return query;},
  order(){return query;},
  range(start:number,end:number){from=start;to=end;return query;},
  then(resolve:(result:unknown)=>unknown){
   const rows=store.rows.filter(row=>filters.every(filter=>filter(row)));
   return Promise.resolve(store.fail&&columns.includes("payment_method")&&!columns.includes("order_items")?{data:null,error:{message:"Connection unavailable"},count:null}:{data:head?null:rows.slice(from,to+1),count:rows.length,error:null}).then(resolve);
  },
 };return query;
}})}));
import { getAdminSnapshot, getAdminOrders } from "./orders";
function row(id:number,overrides:Record<string,unknown>={}) {return {id:String(id),order_number:`JU-${id}`,state:"new",placed_at:"2026-11-18T10:00:00Z",customer_id:null,customer_name:"Test customer",customer_phone_e164:"+255700000000",customer_phone_display:null,delivery_zone_name:"Test zone",delivery_address:"Test address",delivery_fee_tzs:4000,subtotal_tzs:10000,discount_tzs:0,total_tzs:14000,payment_preference:"cash_on_delivery",payment_status:"unpaid",payment_method:null,paid_at:null,reservation_released_at:null,order_items:[],...overrides};}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-18T16:00:00Z"));store.rows=[];store.fail=false;});
afterEach(()=>vi.useRealTimers());
describe("dashboard query totals",()=>{
 it("counts the full queue, while collecting today's payments from earlier orders",async()=>{
  store.rows=Array.from({length:37},(_,i)=>row(i));
  store.rows.push(row(38,{state:"completed",placed_at:"2026-11-10T10:00:00Z",payment_status:"paid",payment_method:"cash",paid_at:"2026-11-18T10:00:00Z",total_tzs:50000}));
  store.rows.push(row(39,{state:"completed",payment_status:"paid",payment_method:"digital",paid_at:"2026-11-17T20:59:59Z",total_tzs:90000}));
  store.rows.push(row(40,{state:"completed",payment_status:"paid",payment_method:"digital",paid_at:"2026-11-17T21:00:00Z",total_tzs:25000}));
  const summary=await getAdminSnapshot();
  expect(summary.counts.new).toBe(37);
  expect(summary.recent).toHaveLength(5);
  expect(summary.cashTzs).toBe(50000);
  expect(summary.digitalTzs).toBe(25000);
  expect(summary.todaySalesTzs).toBe(75000);
 });
 it("does not silently drop orders at the API page boundary",async()=>{
  store.rows=Array.from({length:503},(_,i)=>row(i));
  expect(await getAdminOrders()).toHaveLength(503);
 });
 it("reports an unavailable payment query instead of displaying a false zero",async()=>{
  store.fail=true;
  await expect(getAdminSnapshot()).rejects.toThrow("Could not read collected payments");
 });
});
