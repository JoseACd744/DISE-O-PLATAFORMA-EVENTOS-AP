export interface EventContractItem {
  descripcion: string;
  detalle?: string;
  cantidad?: number;
  monto?: number;
}

export interface EventContractData {
  brand: "donofrio" | "jugueton";
  numero: string;
  clienteNombre: string;
  clienteDocumento: string;
  clienteEmail: string;
  clienteTelefono: string;
  fechaEvento: string;
  direccionEvento: string;
  horarioEntrega: string;
  horarioInicio?: string;
  horarioRecojo: string;
  delivery: boolean;
  movilidad: string;
  personal: string[];
  items: EventContractItem[];
  total: number;
  abonado: number;
  saldo: number;
  esCredito?: boolean;
  observaciones?: string;
  fechasDetalle?: Array<{ fecha:string; direccion:string; entrega:string; inicio?:string; recojo:string; personal?:string[]; observaciones?:string; total:number }>;
  logoUrl?: string;
  bannerUrl?: string;
  footerUrl?: string;
}

const e = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (value: number) => `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildEventContractHtml(d: EventContractData): string {
  const donofrio = d.brand === "donofrio";
  const marca = donofrio ? "D’Onofrio Eventos AP" : "Juguetón Inflables";
  const empresa = donofrio ? "DISTRIBUCIONES Y CONCESIONES AP EIRL" : "JUGUETÓN INFLABLES Y MÁS";
  const ruc = donofrio ? "20556840149" : "20613544250";
  const accent = donofrio ? "#f8d407" : "#ef8022";
  const logo = d.logoUrl || (donofrio ? "/images/eventos_ap.png" : "/images/jugueton.png");
  const dato = (label: string, value: string) => `<p><b>${e(label)}</b> ${e(value || "Por confirmar")}</p>`;
  const detalle = d.items.filter(item => item.descripcion !== "Ajuste de cotización acordado" && !/^(Movilidad|Personal)/i.test(item.descripcion) && item.monto !== undefined).map(item => `${(item.cantidad ?? 1) > 1 ? `${item.cantidad} × ` : ""}${item.descripcion}${item.detalle ? ` (${item.detalle})` : ""}`).join(" / ");
  const horario = d.fechasDetalle?.length ? "Según detalle por fecha" : d.delivery ? d.horarioEntrega : d.horarioInicio ? `${d.horarioInicio} - ${d.horarioRecojo}` : d.horarioEntrega.includes(" - ") || d.horarioRecojo.includes(" - ") ? `Entrega: ${d.horarioEntrega} / Recojo: ${d.horarioRecojo}` : `${d.horarioEntrega} - ${d.horarioRecojo}`;
  const condiciones = [
    "Se emite factura o boleta.",
    d.esCredito ? "Reserva a crédito: el saldo se cancelará según lo acordado con el cliente." : `Se adelanta el 50% del monto para separar su pedido, el saldo será cancelado un día antes de la ${donofrio ? "entrega del carrito" : "instalación"}.`,
    ...(d.delivery ? [] : ["Entrega y recojo se realizarán el mismo día."]),
    ...(donofrio && !d.delivery ? ["El servicio será de 3 horas en algunos distritos lejanos."] : []),
  ];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contrato ${e(marca)} ${e(d.numero)}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#e9edf1;color:#111;font:10pt/1.4 Arial,Helvetica,sans-serif}.actions{padding:12px;text-align:center;background:#172535;position:sticky;top:0;z-index:1}.actions button{border:0;padding:10px 18px;border-radius:6px;font-weight:bold;margin:0 5px;cursor:pointer}.actions button:first-child{background:${accent}}.paper{width:190mm;min-height:277mm;margin:18px auto;background:white}.banner{height:43mm;background:${accent};position:relative;overflow:hidden;print-color-adjust:exact;-webkit-print-color-adjust:exact}.banner:after{content:'';position:absolute;left:15%;top:26mm;width:120%;height:40mm;border-radius:50%;background:#fff9db;transform:rotate(-8deg)}.logo{position:relative;z-index:1;margin:5mm 0 0 12mm;width:35mm;height:27mm;object-fit:contain}.identity{text-align:center;margin-top:-2mm;position:relative;z-index:2;font-family:Georgia,'Times New Roman',serif}.identity h1{font-size:16pt;margin:0}.identity p{margin:0;font-size:11pt}.number{text-align:right;font:bold 9pt Arial,sans-serif;padding-right:18mm}.intro{font-size:9pt;text-align:center;padding:0 20mm;margin:2mm 0}.intro strong{display:block}.body{padding:0 20mm}.data{margin-top:3mm}.data p{margin:0 0 2.3mm;overflow-wrap:anywhere}.amounts{margin-top:5mm}.amounts p{margin-bottom:3mm}.terms{border-top:1px solid #111;margin-top:5mm;padding-top:3mm;font-size:9pt;break-inside:avoid}.terms p{margin:0 0 3mm}.terms ul{margin:0;padding:0;list-style:none}.terms li:before{content:'*'}.footer{font-size:7.5pt;text-align:center;margin-top:10mm;padding-bottom:5mm;break-inside:avoid}.datum{break-inside:avoid}p{margin:0}
    .banner.original{height:auto;background:white}.banner.original:after{display:none}.banner-art{display:block;width:100%;height:auto}.footer img{width:70mm;height:auto}.logo{background:white;border-radius:50%;padding:2mm}
    .banner.jugueton{height:auto;background:white}.banner.jugueton:after{display:none}.banner.jugueton .banner-art{filter:hue-rotate(-49deg) saturate(1.78) contrast(1.06)}.banner.jugueton .logo{position:absolute;left:11mm;top:-1mm;margin:0;width:46mm;height:36mm;padding:2mm;background:white;border-radius:50%}
    @page{size:A4;margin:10mm}@media print{body{background:white}.actions{display:none}.paper{width:190mm;min-height:0;margin:0}}
  </style></head><body><nav class="actions"><button id="print" disabled onclick="window.print()">Imprimir / Guardar PDF</button><button onclick="window.close()">Cerrar</button></nav><main class="paper">
    <div class="banner ${donofrio ? "original" : "jugueton"}"><img class="banner-art" src="${e(d.bannerUrl || "/images/contrato-donofrio-banner.png")}" alt="${donofrio ? "D’Onofrio Eventos AP" : ""}">${donofrio ? "" : `<img class="logo" src="${e(logo)}" alt="${e(marca)}">`}</div>
    <header class="identity"><h1>${e(marca)}</h1><p>${e(empresa)}</p><p>RUC: ${ruc}</p><div class="number">CONTRATO: N° ${e(d.numero)}</div></header>
    <p class="intro"><strong>${donofrio ? "Carritos de Helados D’Onofrio en cumpleaños, matrimonios, reuniones familiares, baby shower, activaciones para empresas y más." : "Juegos inflables, carritos de snacks y complementos para cumpleaños, reuniones familiares y eventos empresariales."}</strong></p>
    <p class="intro">Nos caracterizamos por nuestro buen servicio, seguridad y garantía.</p>
    <section class="body"><div class="data">
      ${dato("Cliente:", d.clienteNombre)}${dato("DNI:", d.clienteDocumento)}${dato("Correo:", d.clienteEmail)}${dato("Dirección de entrega:", d.direccionEvento)}${dato("Fecha de evento:", d.fechaEvento)}${dato("Horario de evento:", horario)}${dato("Celular:", d.clienteTelefono)}${dato("Detalle del paquete:", detalle)}${dato("Movilidad:", d.movilidad)}${dato("Personal de reparto:", d.fechasDetalle?.length ? "Según detalle por fecha" : d.personal.length ? "Sí" : "No")}
      ${d.observaciones?.trim() ? '<p style="white-space:pre-line"><b>Observaciones:</b> '+e(d.observaciones)+'</p>' : ''}
      ${d.fechasDetalle?.length ? '<div><b>Detalle por fecha:</b>'+d.fechasDetalle.map(f=>'<div style="margin:3mm 0;break-inside:avoid"><b>'+e(f.fecha)+'</b> — '+e(f.direccion)+'<br>Entrega: '+e(f.entrega)+(f.inicio?' / Inicio: '+e(f.inicio):'')+' / Recojo: '+e(f.recojo)+' / Total: '+money(f.total)+(f.personal?.length?'<p><b>Personal de reparto:</b> '+f.personal.map(e).join(', ')+'</p>':'')+(f.observaciones?'<p style="white-space:pre-line"><b>Observaciones:</b> '+e(f.observaciones)+'</p>':'')+'</div>').join('')+'</div>' : ''}
      <div class="amounts">${dato("Total:", money(d.total))}${dato("A cuenta:", money(d.abonado))}${dato("Saldo:", money(d.saldo))}</div>
    </div><div class="terms"><p>Términos y condiciones:</p><ul>${condiciones.map(c => `<li>${e(c)}</li>`).join("")}</ul></div></section>
    <footer class="footer"><img src="${e(d.footerUrl || "/images/contrato-donofrio-footer.png")}" alt="Surquillo: Calle Yarinacocha 106 Urb. Calera de la Merced. Barranco: Calle Manco Cápac 102 (Heladería). Cel: 991 980 588 - 994 400 670"></footer>
  </main><script>Promise.all([document.fonts.ready,...Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve}))]).then(()=>{document.getElementById('print').disabled=false;window.contractReady=true});</script></body></html>`;
}
