import {useState} from "react";
import {apiRequest} from "../lib/api";
import {useProducts} from "../contexts/ProductsContext";
import {Modal} from "./ui/modal";
import {Button} from "./ui/button";
import {campo} from "../lib/ui";
type Unidad={id:number;codigo:string;tipo_nombre:string;alquileres_base:number};
export function BasesInflablesEditor({onSaved}:{onSaved:()=>Promise<void>}) {
 const {reloadData}=useProducts();
 const [open,setOpen]=useState(false),[rows,setRows]=useState<Unidad[]>([]),[drafts,setDrafts]=useState<Record<number,string>>({}),[error,setError]=useState(""),[loading,setLoading]=useState(false),[saving,setSaving]=useState<number|null>(null);
 const abrir=async()=>{setOpen(true);setLoading(true);setError("");try{const r=await apiRequest<Unidad[]>("/inflables");setRows(r);setDrafts(Object.fromEntries(r.map(u=>[u.id,String(u.alquileres_base??0)])));}catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar los inflables");}finally{setLoading(false);}};
 const guardar=async(u:Unidad)=>{const n=Number(drafts[u.id]);if(drafts[u.id]?.trim()===""||!Number.isSafeInteger(n)||n<0){setError("Ingresa un número entero mayor o igual a cero.");return;}setSaving(u.id);setError("");try{await apiRequest(`/inflables/${u.id}`,{method:"PUT",body:JSON.stringify({alquileres_base:n})});setRows(prev=>prev.map(r=>r.id===u.id?{...r,alquileres_base:n}:r));await Promise.all([onSaved(),reloadData("inflables")]);}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");}finally{setSaving(null);}};
 return <><Button variant="subtle" onClick={abrir}>Alquileres anteriores</Button>{open&&<Modal open={open} busy={saving!==null} title="Alquileres anteriores por inflable" onClose={()=>{if(saving===null)setOpen(false);}} size="xl" footer={<Button variant="ghost" disabled={saving!==null} onClick={()=>setOpen(false)}>Cerrar</Button>}>
  <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Base por unidad física, anterior a sus fichas en el sistema. Si tuvo 15 alquileres antes y 3 fichas registradas, el acumulado será 18. No incluyas alquileres ya registrados.</p>
  {error&&<p role="alert" className="mb-3 text-red-600">{error}</p>}{loading?<p>Cargando inflables…</p>:rows.length===0?<p>No hay unidades registradas.</p>:<div className="space-y-3">{rows.map(u=><div key={u.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"><div className="min-w-40 flex-1"><p className="font-medium">{u.tipo_nombre} · {u.codigo||`#${u.id}`}</p><p className="text-xs text-gray-500">Base guardada: {u.alquileres_base??0}</p></div><label className="text-sm">Alquileres anteriores<input aria-label={`Base ${u.codigo||u.id}`} type="number" min={0} step={1} value={drafts[u.id]??"0"} onChange={e=>setDrafts(p=>({...p,[u.id]:e.target.value}))} className={`${campo} max-w-32`}/></label><Button variant="brand" disabled={saving!==null||Number(drafts[u.id])===(u.alquileres_base??0)} onClick={()=>guardar(u)}>{saving===u.id?"Guardando…":"Guardar base"}</Button></div>)}</div>}
 </Modal>}</>;
}
