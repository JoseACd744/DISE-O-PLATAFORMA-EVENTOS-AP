import type { Carrito, Inflable, Paquete, Personal } from "../contexts/ProductsContext";

export interface FichaParaOperacion {
  id: number;
  brand: "donofrio" | "jugueton";
  fecha_evento: string;
  fecha_evento_fin?: string;
  cobro_evento?: "una_vez" | "por_dia";
  fecha?: string;
  titulo?: string;
  tipo_evento?: string;
  transporte?: string;
  distrito: string;
  direccion: string;
  referencia?: string;
  hora_entrega: string;
  hora_entrega_fin?: string;
  hora_recojo: string;
  hora_recojo_fin?: string;
  cliente_nombre: string;
  cliente_celular: string;
  contacto_nombre?: string;
  contacto_celular?: string;
  paquetes: Array<{ paqueteId: number; paqueteNombre: string; cantidad: number }>;
  productosSueltos: Array<{ productoNombre: string; cantidad: number }>;
  carritoIds?: number[];
  inflableIds?: number[];
  personalIds?: number[];
  recursos?: Array<{ recurso_nombre: string; cantidad: number; sku: string }>;
  comentarios?: string;
  cotizacion: number;
  descuento: number;
  abonos: Array<{ monto: number }>;
}

export interface AsignacionOperativa {
  fecha: string;
  estado?: string;
  ruta?: string;
  fichas_ids: number[];
  chofer?: { nombre_completo?: string; nombre?: string; numero_telefono?: string; celular?: string } | null;
  vehiculo?: { placa?: string } | null;
}

export interface FichaOperativa {
  id: number;
  marca: string;
  fecha: string;
  fechaFin?: string;
  titulo: string;
  tipoEvento: string;
  modalidad: string;
  distrito: string;
  direccion: string;
  referencia: string;
  entrega: string;
  inicio: string;
  recojo: string;
  cliente: string;
  telefono: string;
  contacto: string;
  contactoTelefono: string;
  paquetes: string[];
  productos: Array<{ nombre: string; cantidad: number }>;
  equipos: string[];
  carritos: string[];
  inflables: string[];
  recursos: string[];
  personal: string[];
  choferes: Array<{ nombre: string; telefono: string; placa: string; ruta: string }>;
  observaciones: string;
  saldo: number;
  alertas: string[];
}

function hora(value?: string): string {
  if (!value) return "Por confirmar";
  const [h, m = "00"] = value.split(":");
  const hours = Number(h);
  if (!Number.isFinite(hours)) return value;
  return `${hours % 12 || 12}:${m.padStart(2, "0")} ${hours >= 12 ? "p. m." : "a. m."}`;
}

function rango(inicio: string, fin?: string): string {
  if (!inicio) return "Por confirmar";
  if (!fin) return hora(inicio);
  const cruzaMedianoche = fin.slice(0, 5) < inicio.slice(0, 5);
  return `${hora(inicio)} - ${hora(fin)}${cruzaMedianoche ? " (+1 día)" : ""}`;
}

export function prepararFichaOperativa(
  ficha: FichaParaOperacion,
  catalogos: { paquetes: Paquete[]; carritos: Carrito[]; inflables: Inflable[]; personal: Personal[] },
  asignaciones: AsignacionOperativa[],
): FichaOperativa {
  const productos = new Map<string, number>();
  const alertas: string[] = [];
  const sumar = (nombre: string, cantidad: number) => {
    if (cantidad > 0) productos.set(nombre, (productos.get(nombre) ?? 0) + cantidad);
  };
  const paquetes = ficha.paquetes.filter(p => p.paqueteId > 0).map(p => {
    const paquete = catalogos.paquetes.find(item => item.id === p.paqueteId);
    if (paquete) paquete.contenido.forEach(item => sumar(item.productoNombre, item.cantidad * p.cantidad));
    else alertas.push(`Confirmar contenido de ${p.paqueteNombre || `paquete #${p.paqueteId}`}.`);
    return `${p.cantidad} × ${p.paqueteNombre || paquete?.nombre || `Paquete #${p.paqueteId}`}${ficha.cobro_evento === "por_dia" ? " por día" : ""}`;
  });
  ficha.productosSueltos.forEach(p => sumar(p.productoNombre, p.cantidad));
  const carritos = (ficha.carritoIds ?? []).filter(id => id > 0).map(id => {
      const item = catalogos.carritos.find(c => c.id === id);
      return item ? `Carrito ${item.codigo} · ${item.modelo}` : `Carrito #${id} · confirmar código`;
    });
  const inflables = (ficha.inflableIds ?? []).filter(id => id > 0).map(id => {
      const item = catalogos.inflables.find(i => i.id === id);
      return item ? `Inflable ${item.codigo} · ${item.tipoNombre}` : `Inflable #${id} · confirmar código`;
    });
  const recursos = (ficha.recursos ?? []).filter(r => r.cantidad > 0).map(r => `${r.cantidad} × ${r.recurso_nombre}${r.sku ? ` · ${r.sku}` : ""}`);
  const equipos = [...carritos, ...inflables, ...recursos];
  const fecha = (ficha.fecha_evento || ficha.fecha || "").slice(0, 10);
  const choferes = asignaciones.filter(a => a.fecha.slice(0, 10) >= fecha && a.fecha.slice(0,10) <= (ficha.fecha_evento_fin || fecha).slice(0,10) && a.fichas_ids.includes(ficha.id) && a.estado !== "cancelada").map(a => ({
    nombre: a.chofer?.nombre_completo || a.chofer?.nombre || "Sin chofer asignado",
    telefono: a.chofer?.numero_telefono || a.chofer?.celular || "Sin teléfono",
    placa: a.vehiculo?.placa || "Sin placa",
    ruta: a.ruta || "",
  }));
  const delivery = ficha.transporte === "delivery";
  return {
    id: ficha.id, marca: ficha.brand === "donofrio" ? "D’Onofrio" : "Juguetón", fecha, fechaFin: ficha.fecha_evento_fin,
    titulo: ficha.titulo || "", tipoEvento: ficha.tipo_evento || (delivery ? "Delivery" : "Evento"), modalidad: delivery ? "DELIVERY" : "EVENTO",
    distrito: ficha.distrito || "Distrito por confirmar", direccion: ficha.direccion || "Dirección por confirmar", referencia: ficha.referencia || "",
    entrega: ficha.brand === "jugueton" ? hora(ficha.hora_entrega) : rango(ficha.hora_entrega, ficha.hora_entrega_fin),
    inicio: ficha.brand === "jugueton" ? hora(ficha.hora_entrega_fin) : "",
    recojo: delivery ? "No aplica (delivery)" : ficha.brand === "jugueton" ? hora(ficha.hora_recojo) : rango(ficha.hora_recojo, ficha.hora_recojo_fin),
    cliente: ficha.cliente_nombre || "Cliente por confirmar", telefono: ficha.cliente_celular || "Sin teléfono",
    contacto: ficha.contacto_nombre || "", contactoTelefono: ficha.contacto_celular || "",
    paquetes, productos: Array.from(productos, ([nombre, cantidad]) => ({ nombre, cantidad })), equipos, carritos, inflables, recursos,
    personal: (ficha.personalIds ?? []).filter(id => id > 0).map(id => {
      const p = catalogos.personal.find(item => item.id === id);
      return p?.nombre_completo || p?.nombre || `Personal #${id} por confirmar`;
    }),
    choferes, observaciones: ficha.comentarios || "", alertas,
    saldo: Math.max(0, Math.round((ficha.cotizacion * (1 - (ficha.descuento || 0) / 100) - ficha.abonos.reduce((sum, a) => sum + a.monto, 0)) * 100) / 100),
  };
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function fechaEtiqueta(fecha: string): string {
  const parsed = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "FECHA POR CONFIRMAR";
  return parsed.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();
}

function tarjeta(f: FichaOperativa): string {
  const lista = (items: string[]) => `<ul class="checklist">${items.map(item => `<li><i class="box"></i><span>${escape(item)}</span></li>`).join("")}</ul>`;
  return `<article class="order">
    <header><strong>${escape(fechaEtiqueta(f.fecha))}${f.fechaFin && f.fechaFin.slice(0,10)!==f.fecha ? " AL "+escape(fechaEtiqueta(f.fechaFin.slice(0,10))) : ""}</strong><span>Tipo de evento: ${escape(f.tipoEvento)}${f.modalidad === "DELIVERY" && f.tipoEvento !== "Delivery" ? " · DELIVERY" : ""}</span>${f.titulo ? `<b class="event-title">${escape(f.titulo)}</b>` : ""}</header>
    <div class="location"><b>${escape(f.distrito)}</b><span> · ${escape(f.direccion)}</span>${f.referencia ? `<small> · Ref: ${escape(f.referencia)}</small>` : ""}</div>
    <div class="times"><div><b>Entrega: ${escape(f.entrega)}</b></div>${f.inicio ? `<div><b>Inicio: ${escape(f.inicio)}</b></div>` : ""}<div><b>Recojo: ${escape(f.recojo)}</b></div></div>
    <div class="section order-items">${f.paquetes.length ? `<p class="packages">${f.paquetes.map(escape).join(" / ")}</p>` : ""}
      ${f.productos.length ? `<ul class="products">${f.productos.map(p => `<li><i class="box"></i><b>${p.cantidad}</b><span>${escape(p.nombre)}</span></li>`).join("")}</ul>` : f.equipos.length ? "" : `<p>Confirmar productos a alistar.</p>`}
      ${f.alertas.map(a => `<p class="alert">${escape(a)}</p>`).join("")}
    </div>
    ${f.personal.length ? `<p class="section crew"><b>Personal de reparto /</b> ${f.personal.map(escape).join(" / ")}</p>` : ""}
    ${f.equipos.length ? `<div class="section equipment">${lista(f.equipos)}</div>` : ""}
    ${f.observaciones ? `<div class="notes">${escape(f.observaciones)}</div>` : ""}
    <div class="contacts"><p><b>Cliente:</b> ${escape(f.cliente)} · <strong>${escape(f.telefono)}</strong></p>${f.contacto || f.contactoTelefono ? `<p><b>Contacto alternativo:</b> ${escape(f.contacto || f.cliente)} · <strong>${escape(f.contactoTelefono || f.telefono)}</strong></p>` : ""}</div>
    <div class="driver">${f.choferes.length ? f.choferes.map(c => `<p><b>Chofer:</b> ${escape(c.nombre)} · ${escape(c.telefono)} · <b>Placa carro:</b> ${escape(c.placa)}${c.ruta ? ` · ${escape(c.ruta)}` : ""}</p>`).join("") : `<p><b>Chofer:</b> __________ · <b>Tel.:</b> __________ · <b>Placa carro:</b> __________</p>`}</div>
    <footer><span><i class="box"></i> Entregado</span><span><i class="box"></i> Recogido</span></footer>
  </article>`;
}

export function buildFichasOperativasHtml(fichas: FichaOperativa[]): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fichas operativas - ${fichas.length} pedidos</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#18212a;background:#e9edf0;font-size:8pt;line-height:1.2}
    .toolbar{position:sticky;top:0;z-index:2;background:#18212a;color:white;padding:14px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.toolbar p{margin:0;flex:1}.toolbar small{display:block;margin-top:4px;color:#d5dce2}.toolbar button{padding:10px 16px;border:0;border-radius:6px;background:#ffe082;font-weight:bold;cursor:pointer}.toolbar button:disabled{opacity:.5;cursor:wait}
    #pages{padding:18px}.sheet{width:196mm;margin:0 auto 16px;background:white;box-shadow:0 2px 12px #0002;padding:0}.grid{display:grid;grid-template-columns:96mm 96mm;grid-template-rows:repeat(136,2mm);column-gap:4mm;row-gap:0}.page-footer{height:5mm;font-size:6.5pt;text-align:right;padding-top:2mm;color:#68727a}
    .order{border:.35mm solid #43515c;border-radius:2mm;padding:1.7mm;min-height:58mm;display:flex;flex-direction:column;overflow-wrap:anywhere;background:#fff;break-inside:avoid}
    header{display:flex;justify-content:space-between;gap:2mm;border-bottom:.4mm solid #18212a;padding-bottom:.7mm}header strong{font-size:9.5pt;display:block}header span{font-size:6.5pt;display:block;margin-top:.4mm}.number{font-size:11pt}
    p{margin:0}label{display:block;font-size:6.4pt;font-weight:bold;letter-spacing:.2pt}.location{margin:.8mm 0}.location b{display:block;font-size:8.5pt}.location span{display:block}.location small{display:block;font-size:7pt;margin-top:.5mm}
    .times{display:flex;gap:1mm;padding:.7mm 0;border-top:.2mm solid #9ba4aa;border-bottom:.2mm solid #9ba4aa}.times div{flex:1}.times b{display:block;font-size:8pt;margin-top:.3mm}
    .section{margin-top:.7mm}.packages{font-weight:bold;margin:.5mm 0}.products,.checklist{margin:.5mm 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:.5mm 2mm}.products li,.checklist li{display:flex;gap:.7mm;align-items:baseline}.products li b{font-size:8.2pt}.box{display:inline-block;width:2.2mm;height:2.2mm;border:.2mm solid #3e4b54;flex-shrink:0;vertical-align:middle}.checklist li{width:100%;font-size:7.2pt}
    .crew{font-size:7pt;margin-top:1mm}.notes{padding:1mm;margin-top:1mm;border:.25mm solid #838c94;background:#f6f6f4;font-size:7.4pt;white-space:pre-wrap}.alert{font-weight:bold;font-size:7pt}.contacts{border-top:.2mm solid #afb5b9;padding-top:1mm;margin-top:1mm;font-size:7.2pt}.contacts p+p{margin-top:.5mm}.driver{margin-top:1mm;font-size:7pt}.driver p+p{margin-top:.5mm}
    footer{display:flex;justify-content:space-between;gap:1mm;margin-top:auto;padding-top:1.5mm;font-size:7.2pt}footer span{white-space:nowrap}
    .order{print-color-adjust:exact;-webkit-print-color-adjust:exact}header strong{color:#174675;font-size:9pt}header>div{min-width:0;flex:1}.number{flex-shrink:0;color:#174675}header .event-title{font-size:7pt}.location b,.location span{color:#174675;font-weight:bold}.times{border-color:#8a3045;background:#fff6f8}.times label,.times b{color:#8a3045}.order-items>label,.packages{color:#17613f}.crew label{color:#663a80}.crew p{font-weight:bold;margin-top:.5mm}.equipment label{color:#245b75}.notes{border-color:#995018;background:#fff9ed}.notes>b{color:#874010}
    header .event-title{max-width:34%;font-size:8pt;text-align:right;color:#174675}.times{flex-wrap:wrap;gap:1mm 3mm}.times div{flex:1 1 auto}.crew>b{color:#663a80}.equipment{color:#245b75}.notes{color:#874010}
    header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.4mm 2mm}header strong{grid-column:1 / -1;font-size:8.5pt}header span{margin:0}header .event-title{max-width:32mm;font-size:7pt;align-self:start}.location b,.location span,.location small{display:inline}.location b{font-size:8pt}.location small{margin:0}.checklist li{width:auto}.contacts p{display:inline}.contacts p+p{margin:0}.contacts p+p:before{content:' · '}.notes{padding:.6mm .8mm;margin-top:.7mm}.contacts{padding-top:.7mm;margin-top:.7mm}.driver{margin-top:.7mm}footer{padding-top:1mm}
    #measure{position:absolute;left:-2000px;width:96mm;visibility:hidden}.large .grid{display:block;height:auto}.large .order{break-inside:auto}
    @page{size:A4 portrait;margin:7mm}@media print{body{background:white}.toolbar,#measure{display:none!important}#pages{padding:0}.sheet{margin:0;box-shadow:none;break-after:page}.sheet:last-child{break-after:auto}.order{border-radius:0}.notes{background:white}}
  </style></head><body>
  <div class="toolbar"><p><b>Fichas de alistado y reparto · ${fichas.length} pedido(s)</b><small>A4 · tamaño compacto · hasta 8 fichas por hoja. Los pedidos con más detalle ocupan más espacio. Imprime al 100%, sin encabezados ni pies del navegador.</small></p><button id="print" disabled onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <div id="measure">${fichas.map(tarjeta).join("")}</div><main id="pages"></main>
  <script>
    async function organizar(){
      await document.fonts.ready;
      const mm=96/25.4, unit=2*mm, gap=4*mm, maxRows=136;
      const pages=document.getElementById('pages');let sheet,grid,slots;
      function nueva(){sheet=document.createElement('section');sheet.className='sheet';grid=document.createElement('div');grid.className='grid';sheet.append(grid);pages.append(sheet);slots=Array.from({length:maxRows},()=>[false,false]);}
      const cards=Array.from(document.querySelectorAll('#measure .order'));
      for(const card of cards){
        const rows=Math.max(1,Math.ceil((card.getBoundingClientRect().height+gap)/unit));
        if(rows>maxRows){nueva();sheet.classList.add('large');grid.append(card);sheet=null;continue;}
        if(!sheet)nueva();
        function sitio(){for(let r=0;r<=maxRows-rows;r++)for(let c=0;c<2;c++)if(Array.from({length:rows},(_,i)=>!slots[r+i][c]).every(Boolean))return [r,c];return null;}
        let at=sitio();if(!at){nueva();at=sitio();}
        const [r,c]=at;for(let i=0;i<rows;i++)slots[r+i][c]=true;
        card.style.marginBottom='4mm';card.style.gridRow=(r+1)+' / span '+rows;card.style.gridColumn=String(c+1);grid.append(card);
      }
      Array.from(pages.children).forEach((p,i)=>{const foot=document.createElement('div');foot.className='page-footer';foot.textContent='Fichas operativas · hoja '+(i+1)+' de '+pages.children.length;p.append(foot);});
      document.getElementById('measure').remove();document.getElementById('print').disabled=false;window.printLayoutReady=true;
    }
    organizar();
  </script></body></html>`;
}
