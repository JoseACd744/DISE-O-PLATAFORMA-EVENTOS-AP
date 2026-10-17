export interface VentaHistorica { mes: string; monto: number | string; nota?: string; }
export function mesesCompletos(rows: VentaHistorica[], desde: string, hasta: string) {
  return rows.filter(r => {
    const [y,m] = r.mes.split("-").map(Number);
    const fin = `${r.mes}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;
    return `${r.mes}-01` >= desde && fin <= hasta;
  });
}
export const sumarHistorico = (rows: VentaHistorica[], desde: string, hasta: string) => mesesCompletos(rows,desde,hasta).reduce((s,r)=>s+Number(r.monto),0);
export function rankingInflables(unidades: Array<{id:number;tipoNombre:string;alquileresBase?:number}>, fichas: any[]) {
  const porUnidad=new Map<number,number>();
  fichas.filter(f=>!f.es_cotizacion).forEach(f=>[...new Set<number>(f.inflableIds ?? (f.inflables??[]).map((i:any)=>Number(i.id)))].forEach(id=>porUnidad.set(id,(porUnidad.get(id)||0)+1)));
  const tipos=new Map<string,{etiqueta:string;base:number;sistema:number;valor:number}>();
  unidades.forEach(u=>{const etiqueta=u.tipoNombre||"Inflable";const t=tipos.get(etiqueta)||{etiqueta,base:0,sistema:0,valor:0};t.base+=Number(u.alquileresBase||0);t.sistema+=porUnidad.get(u.id)||0;t.valor=t.base+t.sistema;tipos.set(etiqueta,t);});
  return [...tipos.values()].filter(t=>t.valor>0).sort((a,b)=>b.valor-a.valor);
}
export function rankingProductosIndividuales(fichas: any[]) {
  const map=new Map<string,number>();
  fichas.filter(f=>!f.es_cotizacion).forEach(f=>(f.productosSueltos||[]).forEach((p:any)=>{const nombre=p.producto_nombre||p.productoNombre||"Producto";map.set(nombre,(map.get(nombre)||0)+Number(p.cantidad||0));}));
  return [...map].map(([etiqueta,valor])=>({etiqueta,valor})).filter(r=>r.valor>0).sort((a,b)=>b.valor-a.valor);
}
