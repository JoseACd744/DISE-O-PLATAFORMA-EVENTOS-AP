import {useState} from "react";
import {apiRequest} from "../lib/api";
import {Modal} from "./ui/modal";
import {Button} from "./ui/button";
import {campo,etiqueta} from "../lib/ui";
import {getLocalDateString} from "../lib/date";
import type {VentaHistorica} from "../lib/reportesHistoricos";
const dinero=(n:number)=>`S/ ${n.toFixed(2)}`;
export function VentasHistoricasEditor({brand,rows,onUpdated,ventasSistema}:{brand:string;rows:VentaHistorica[];onUpdated:(row:VentaHistorica)=>void;ventasSistema:(mes:string)=>number}) {
 const hoy=new Date();const anterior=getLocalDateString(new Date(hoy.getFullYear(),hoy.getMonth()-1,1)).slice(0,7);
 const [open,setOpen]=useState(false),[mes,setMes]=useState(anterior),[monto,setMonto]=useState(""),[nota,setNota]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 const seleccionar=(m:string)=>{setMes(m);const r=rows.find(r=>r.mes===m);setMonto(r?String(r.monto):"");setNota(r?.nota||"");setError("");};
 const guardar=async()=>{if(!mes||monto.trim()===""){setError("Completa el mes y el monto histórico.");return;}setSaving(true);setError("");try{const r=await apiRequest<VentaHistorica>("/ventas-historicas",{method:"PUT",body:JSON.stringify({brand,mes,monto:Number(monto),nota})});onUpdated(r);setOpen(false);}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");}finally{setSaving(false);}};
 return <><Button variant="subtle" onClick={()=>{seleccionar(anterior);setOpen(true);}}>Ventas de meses anteriores</Button>
 {open&&<Modal open={open} busy={saving} title="Ventas históricas por mes" onClose={()=>{if(!saving)setOpen(false);}} size="lg" footer={<><Button variant="ghost" disabled={saving} onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="brand" disabled={saving} onClick={guardar}>{saving?"Guardando…":"Guardar histórico"}</Button></>}>
  <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Ingresa solo ventas anteriores que no están registradas en fichas. Este monto se suma a las ventas del sistema de la marca seleccionada; editar el mismo mes reemplaza el importe anterior.</p>
  {error&&<p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
  <div className="grid gap-3 sm:grid-cols-2"><label className={etiqueta}>Mes anterior<input aria-label="Mes histórico" type="month" value={mes} max={anterior} onChange={e=>seleccionar(e.target.value)} className={campo}/></label>
  <label className={etiqueta}>Ventas antiguas sin fichas (S/)<input aria-label="Monto histórico" type="number" min={0} step="0.01" value={monto} onChange={e=>setMonto(e.target.value)} className={campo}/></label></div>
  <label className={`${etiqueta} mt-3 block`}>Referencia (opcional)<input value={nota} onChange={e=>setNota(e.target.value)} maxLength={500} className={campo} placeholder="Ej.: cuaderno de ventas, julio"/></label>
  <p className="my-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-700">Sistema: {dinero(ventasSistema(mes))} + histórico: {dinero(Number(monto)||0)} = {dinero(ventasSistema(mes)+(Number(monto)||0))}.</p>
  <p className="text-xs text-gray-500">Sin fichas ficticias, abonos ni saldos por cobrar. Se incluye en ventas y cuotas de meses completos; no se asigna a días concretos ni al ticket promedio.</p>
  {rows.length>0&&<div className="mt-4 max-h-52 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Mes</th><th className="text-right">Histórico</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.mes}><td>{r.mes}</td><td className="text-right">{dinero(Number(r.monto))}</td><td className="text-right"><button type="button" className="p-2 text-brand-orange" onClick={()=>seleccionar(r.mes)}>Editar {r.mes}</button></td></tr>)}</tbody></table></div>}
 </Modal>}</>;
}
