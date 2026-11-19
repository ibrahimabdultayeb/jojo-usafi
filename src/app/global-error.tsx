"use client";

import { useState } from "react";
import LatticeLoader from "@/components/ui/LatticeLoader";

/** Root-layout failures cannot use the catalogue, session or their providers. */
export default function GlobalError() {
  const [reloading, setReloading] = useState(false);
  return <html lang="en"><body style={{ margin:0,background:"#0c1727",color:"#e8eef8",fontFamily:"system-ui,sans-serif" }}>
    <main style={{minHeight:"100dvh",boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center",gap:20}}>
      <strong style={{fontSize:18,color:"#8abaff"}}>JOJO USAFI</strong>
      <h1 style={{fontSize:32,margin:0}}>We couldn’t load this page</h1>
      <p role="alert" style={{maxWidth:440,lineHeight:1.7,color:"#afbed1",margin:0}}>The service may be temporarily unavailable. Reload to try again.</p>
      <button disabled={reloading} aria-busy={reloading} onClick={() => { setReloading(true); window.location.reload(); }} style={{display:"inline-flex",alignItems:"center",gap:10,minHeight:48,padding:"12px 28px",border:0,borderRadius:12,background:"#276bce",color:"white",fontSize:16,fontWeight:700,cursor:"pointer"}}>{reloading && <LatticeLoader decorative showTimer={false} cellSize={4} gap={1.5} shape="square" pattern="orbit"/>}{reloading ? "Reloading…" : "Reload page"}</button>
    </main>
  </body></html>;
}
