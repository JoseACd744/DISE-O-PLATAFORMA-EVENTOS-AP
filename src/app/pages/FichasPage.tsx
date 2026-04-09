import { useState, useMemo, useEffect } from "react";
import { Calendar, MapPin, Clock, User, Phone, Package as PackageIcon, Plus, Eye, Edit, Search, X, Trash2, Layers, ShoppingBag, DollarSign, CreditCard, Receipt, Upload, CheckCircle2, AlertCircle, CircleDashed, Hash, Wind, FileText } from "lucide-react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "../components/DateRangePicker";
import { useProducts } from "../contexts/ProductsContext";
import { useBrand } from "../contexts/BrandContext";
import { apiRequest } from "../lib/api";

// ── Financial types ──────────────────────────────────────────────

interface Abono {
  id: number;
  fecha: string;
  monto: number;
  numeroOperacion: string;
  comprobante?: string; // filename
  comprobantePreview?: string; // data URL for preview
  medio: "Transferencia" | "Yape" | "Plin" | "Efectivo";
}

interface FichaPaquete {
  paqueteId: number;
  paqueteNombre: string;
  paqueteTipo: string;
  cantidad: number;
}

interface FichaProductoSuelto {
  productoNombre: string;
  cantidad: number;
}

type EstadoPago = "pagado" | "parcial" | "pendiente";

interface Ficha {
  id: number;
  fecha: string;
  distrito: string;
  direccion: string;
  referencia?: string;
  hora_entrega: string;
  hora_recojo: string;
  paquetes: FichaPaquete[];
  productosSueltos: FichaProductoSuelto[];
  // Recursos asignados (ambas marcas pueden usar carritos)
  carritoIds?: number[]; // IDs de carritos del catálogo
  // Campos específicos de Jugueton (inflables)
  inflableIds?: number[]; // IDs de inflables seleccionados
  horasServicio?: number; // Horas de servicio de inflables
  comentarios?: string;
  personalIds?: number[];
  cliente_nombre: string;
  cliente_celular: string;
  contacto_nombre?: string;
  contacto_celular?: string;
  // Financial
  cotizacion: number;
  descuento: number;
  abonos: Abono[];
  // Brand identifier
  brand: "donofrio" | "jugueton";
}

interface FichaFormData {
  fecha: string;
  distrito: string;
  direccion: string;
  referencia: string;
  hora_entrega: string;
  hora_recojo: string;
  comentarios: string;
  horasServicio: number;
  cliente_nombre: string;
  cliente_celular: string;
  contacto_nombre: string;
  contacto_celular: string;
  cotizacion: number;
  descuento: number;
  paquetes: FichaPaquete[];
  productosSueltos: FichaProductoSuelto[];
  carritoIds: number[];
  inflableIds: number[];
  personalIds: number[];
}

const getInitialFormData = (): FichaFormData => ({
  fecha: new Date().toISOString().slice(0, 10),
  distrito: "",
  direccion: "",
  referencia: "",
  hora_entrega: "",
  hora_recojo: "",
  comentarios: "",
  horasServicio: 2,
  cliente_nombre: "",
  cliente_celular: "",
  contacto_nombre: "",
  contacto_celular: "",
  cotizacion: 0,
  descuento: 0,
  paquetes: [{ paqueteId: 0, paqueteNombre: "", paqueteTipo: "", cantidad: 1 }],
  productosSueltos: [],
  carritoIds: [],
  inflableIds: [],
  personalIds: [],
});

const DISTRITOS_LIMA = [
  "Ancón",
  "Ate",
  "Barranco",
  "Breña",
  "Carabayllo",
  "Chaclacayo",
  "Chorrillos",
  "Cieneguilla",
  "Comas",
  "El Agustino",
  "Independencia",
  "Jesús María",
  "La Molina",
  "La Victoria",
  "Lima",
  "Lince",
  "Los Olivos",
  "Lurigancho",
  "Lurín",
  "Magdalena del Mar",
  "Miraflores",
  "Pachacámac",
  "Pucusana",
  "Pueblo Libre",
  "Puente Piedra",
  "Punta Hermosa",
  "Punta Negra",
  "Rímac",
  "San Bartolo",
  "San Borja",
  "San Isidro",
  "San Juan de Lurigancho",
  "San Juan de Miraflores",
  "San Luis",
  "San Martín de Porres",
  "San Miguel",
  "Santa Anita",
  "Santa María del Mar",
  "Santa Rosa",
  "Santiago de Surco",
  "Surquillo",
  "Villa El Salvador",
  "Villa María del Triunfo",
];

// ── Helpers ──────────────────────────────────────────────────────

function getTotal(f: Ficha) { return f.cotizacion - f.descuento; }
function getTotalAbonado(f: Ficha) { return f.abonos.reduce((s, a) => s + a.monto, 0); }
function getSaldo(f: Ficha) { return getTotal(f) - getTotalAbonado(f); }
function getEstadoPago(f: Ficha): EstadoPago {
  const saldo = getSaldo(f);
  if (saldo <= 0) return "pagado";
  if (getTotalAbonado(f) > 0) return "parcial";
  return "pendiente";
}
function formatMoney(n: number) { return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`; }

function getBrandMeta(brand: Ficha["brand"]) {
  return brand === "donofrio"
    ? {
        label: "D'Onofrio",
        logoUrl: "/images/eventos_ap.png",
        badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        logoClass: "w-7 h-4 rounded-sm object-contain bg-white p-0.5",
        miniLogoInlineStyle: "width:32px; height:16px; border-radius:4px; object-fit:contain; background:#fff; padding:1px;",
      }
    : {
        label: "Juguetón",
        logoUrl: "/images/jugueton.png",
        badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        logoClass: "w-4 h-4 rounded-full object-cover",
        miniLogoInlineStyle: "width:18px; height:18px; border-radius:999px; object-fit:cover;",
      };
}

// ── Main Component ───────────────────────────────────────────────

export function FichasPage() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDistrito, setSelectedDistrito] = useState<string>("Todos");
  const [selectedFicha, setSelectedFicha] = useState<Ficha | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoTargetFicha, setAbonoTargetFicha] = useState<Ficha | null>(null);
  const [formData, setFormData] = useState<FichaFormData>(getInitialFormData());
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [estadoFilter, setEstadoFilter] = useState<"Todos" | EstadoPago>("Todos");

  const { brand } = useBrand();
  const { paquetes: contextPaquetes, productNames, carritos, inflables, personales } = useProducts();

  const loadFichas = async () => {
    if (!brand) return;
    setLoading(true);
    setError("");
    try {
      const list = await apiRequest<Array<{ id: number }>>(`/fichas?brand=${brand}`);
      const details = await Promise.all(
        list.map((item) => apiRequest<any>(`/fichas/${item.id}`))
      );

      const mapped: Ficha[] = details.map((f) => ({
        id: f.id,
        fecha: f.fecha,
        distrito: f.distrito || "",
        direccion: f.direccion || "",
        referencia: f.referencia || "",
        hora_entrega: f.hora_entrega || "",
        hora_recojo: f.hora_recojo || "",
        paquetes: (f.paquetes || []).map((p: any) => ({
          paqueteId: p.paquete_id || 0,
          paqueteNombre: p.paquete_nombre || "",
          paqueteTipo: p.paquete_tipo || "",
          cantidad: p.cantidad || 1,
        })),
        productosSueltos: (f.productosSueltos || []).map((p: any) => ({
          productoNombre: p.producto_nombre,
          cantidad: p.cantidad || 1,
        })),
        carritoIds: f.carritoIds || [],
        inflableIds: f.inflableIds || [],
        horasServicio: f.horas_servicio || undefined,
        comentarios: f.comentarios || "",
        personalIds: f.personalIds || [],
        cliente_nombre: f.cliente_nombre,
        cliente_celular: f.cliente_celular || "",
        contacto_nombre: f.contacto_nombre || "",
        contacto_celular: f.contacto_celular || "",
        cotizacion: Number(f.cotizacion || 0),
        descuento: Number(f.descuento || 0),
        brand: f.brand,
        abonos: (f.abonos || []).map((a: any) => ({
          id: a.id,
          fecha: a.fecha,
          monto: Number(a.monto || 0),
          numeroOperacion: a.numero_operacion || "",
          comprobante: a.comprobante_url || "",
          medio: a.medio,
        })),
      }));

      setFichas(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las fichas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFichas();
  }, [brand]);
  // Filtrar paquetes solo de la marca actual (Donofrio tiene carritos, Jugueton no)
  const paquetesDisponibles = contextPaquetes
    .filter(p => p.brand === brand)
    .map(p => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, precio: p.precioUnitario }));

  const distritos = ["Todos", ...Array.from(new Set(fichas.filter(f => f.brand === brand).map(f => f.distrito)))];

  const filteredFichas = fichas.filter(ficha => {
    const matchesSearch = ficha.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ficha.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ficha.distrito.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDistrito = selectedDistrito === "Todos" || ficha.distrito === selectedDistrito;
    const matchesEstado = estadoFilter === "Todos" || getEstadoPago(ficha) === estadoFilter;
    const matchesBrand = ficha.brand === brand; // Solo mostrar fichas de la marca actual
    let matchesFecha = true;
    if (dateRange?.from && dateRange?.to) {
      const d = new Date(ficha.fecha);
      matchesFecha = d >= new Date(dateRange.from) && d <= new Date(dateRange.to);
    } else if (dateRange?.from) matchesFecha = new Date(ficha.fecha) >= new Date(dateRange.from);
    else if (dateRange?.to) matchesFecha = new Date(ficha.fecha) <= new Date(dateRange.to);
    return matchesSearch && matchesDistrito && matchesFecha && matchesEstado && matchesBrand;
  });

  // Financial stats
  const stats = useMemo(() => {
    const ventaTotal = fichas.reduce((s, f) => s + f.cotizacion, 0);
    const descuentos = fichas.reduce((s, f) => s + f.descuento, 0);
    const totalAbonado = fichas.reduce((s, f) => s + getTotalAbonado(f), 0);
    const saldoPendiente = fichas.reduce((s, f) => s + Math.max(0, getSaldo(f)), 0);
    const pagadas = fichas.filter(f => getEstadoPago(f) === "pagado").length;
    const parciales = fichas.filter(f => getEstadoPago(f) === "parcial").length;
    const pendientes = fichas.filter(f => getEstadoPago(f) === "pendiente").length;
    return { ventaTotal, descuentos, totalAbonado, saldoPendiente, pagadas, parciales, pendientes };
  }, [fichas]);

  const getPaqueteColor = (tipo: string) => {
    switch (tipo) {
      case "BASICO": return "bg-[#1F3C8B]/10 text-[#1F3C8B] dark:bg-[#1F3C8B]/20 dark:text-blue-400";
      case "PERSONALIZADO": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "100 MINIS": return "bg-[#EF8022]/10 text-[#EF8022] dark:bg-[#EF8022]/20";
      case "VACILÓN": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getUnidadesHelado = (ficha: Ficha) => {
    const unidadesPaquetes = ficha.paquetes.reduce((sum, fp) => {
      const paquete = contextPaquetes.find(p => p.id === fp.paqueteId);
      if (!paquete) return sum;
      const unidadesBase = paquete.contenido.reduce((s, item) => s + item.cantidad, 0);
      return sum + (unidadesBase * fp.cantidad);
    }, 0);
    const unidadesSueltas = ficha.productosSueltos.reduce((s, p) => s + p.cantidad, 0);
    return unidadesPaquetes + unidadesSueltas;
  };

  const getNombresPersonal = (ficha: Ficha) => {
    const ids = ficha.personalIds ?? [];
    return ids.map(id => personales.find(p => p.id === id)?.nombre).filter(Boolean) as string[];
  };

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatDate = (dateIso: string) => {
    const d = new Date(`${dateIso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateIso;
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  };

  const handleGenerarProforma = (ficha: Ficha) => {
    const total = getTotal(ficha);
    const abonado = getTotalAbonado(ficha);
    const saldo = Math.max(0, getSaldo(ficha));
    const unidadesHelado = getUnidadesHelado(ficha);
    const brandMeta = getBrandMeta(ficha.brand);
    const fechaEmision = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const fechaParaArchivo = new Date().toISOString().slice(0, 10);
    const numeroFicha = String(ficha.id).padStart(4, "0");
    const defaultFileName = ficha.brand === "jugueton"
      ? `Cotizacion_Jugueton_${numeroFicha}_${fechaParaArchivo}`
      : `Proforma_Donofrio_${numeroFicha}_${fechaParaArchivo}`;
    const estadoPago = getEstadoPago(ficha);
    const carritoDetalle = (ficha.carritoIds ?? [])
      .map(id => carritos.find(c => c.id === id))
      .filter(Boolean)
      .map(c => `${c!.codigo} - ${c!.modelo}`);
    const inflableDetalle = (ficha.inflableIds ?? [])
      .map(id => inflables.find(i => i.id === id)?.nombre)
      .filter(Boolean) as string[];
    const personalDetalle = getNombresPersonal(ficha);
    const config = ficha.brand === "donofrio"
      ? {
          empresa: "EventosAP x D'Onofrio",
          subtitulo: "Proforma de Servicio de Heladería",
          colorPrimario: "#1F3C8B",
          colorSecundario: "#EF8022",
          logoUrl: "/images/eventos_ap.png",
        }
      : {
          empresa: "Juguetón Eventos",
          subtitulo: "Proforma de Servicio de Inflables y Animación",
          colorPrimario: "#0F766E",
          colorSecundario: "#F59E0B",
          logoUrl: "/images/jugueton.png",
        };

    const lineasPaquetes = ficha.paquetes.map((p, index) => {
      const paqueteCatalogo = contextPaquetes.find(cp => cp.id === p.paqueteId);
      const precioUnitario = paqueteCatalogo?.precioUnitario ?? 0;
      const subtotal = precioUnitario * p.cantidad;
      return {
        item: index + 1,
        descripcion: `${p.paqueteNombre} (${p.paqueteTipo})`,
        cantidad: p.cantidad,
        precioUnitario,
        subtotal,
      };
    });

    const lineasSueltos = ficha.productosSueltos.map((p, index) => ({
      item: lineasPaquetes.length + index + 1,
      descripcion: `${p.productoNombre} (Producto adicional)`,
      cantidad: p.cantidad,
      precioUnitario: 0,
      subtotal: 0,
    }));

    const lineasRecursos = [
      ...(carritoDetalle.length > 0
        ? [{ item: lineasPaquetes.length + lineasSueltos.length + 1, descripcion: `Carritos asignados: ${carritoDetalle.join(" | ")}`, cantidad: 1, precioUnitario: 0, subtotal: 0 }]
        : []),
      ...(inflableDetalle.length > 0
        ? [{ item: lineasPaquetes.length + lineasSueltos.length + (carritoDetalle.length > 0 ? 2 : 1), descripcion: `Inflables asignados: ${inflableDetalle.join(" | ")}`, cantidad: 1, precioUnitario: 0, subtotal: 0 }]
        : []),
    ];

    const detalleConceptos = [...lineasPaquetes, ...lineasSueltos, ...lineasRecursos];
    const montoPaquetes = lineasPaquetes.reduce((sum, l) => sum + l.subtotal, 0);

    const filasDetalle = detalleConceptos.length > 0
      ? detalleConceptos.map(l => `
          <tr>
            <td style="text-align:center; width:40px;">${l.item}</td>
            <td>${escapeHtml(l.descripcion)}</td>
            <td style="text-align:center; width:80px;">${l.cantidad}</td>
            <td style="text-align:right; width:120px;">${l.precioUnitario > 0 ? formatMoney(l.precioUnitario) : "-"}</td>
            <td style="text-align:right; width:120px;">${l.subtotal > 0 ? formatMoney(l.subtotal) : "-"}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" style="text-align:center; color:#6B7280;">Sin conceptos registrados</td></tr>`;

    const filasPaquetes = ficha.paquetes.length > 0
      ? ficha.paquetes.map(p => `
          <tr>
            <td>${escapeHtml(p.paqueteNombre)}</td>
            <td>${escapeHtml(p.paqueteTipo)}</td>
            <td style="text-align:center;">${p.cantidad}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="3" style="text-align:center; color:#6B7280;">Sin paquetes</td></tr>`;

    const filasSueltos = ficha.productosSueltos.length > 0
      ? ficha.productosSueltos.map(p => `
          <tr>
            <td>${escapeHtml(p.productoNombre)}</td>
            <td style="text-align:center;">${p.cantidad}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="2" style="text-align:center; color:#6B7280;">Sin productos adicionales</td></tr>`;

    const filasAbonos = ficha.abonos.length > 0
      ? ficha.abonos.map((a, idx) => `
          <tr>
            <td style="text-align:center; width:40px;">${idx + 1}</td>
            <td>${escapeHtml(a.fecha)}</td>
            <td>${escapeHtml(a.medio)}</td>
            <td>${escapeHtml(a.numeroOperacion || "-")}</td>
            <td style="text-align:right;">${formatMoney(a.monto)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" style="text-align:center; color:#6B7280;">Sin abonos registrados</td></tr>`;

    const popup = window.open("", `proforma-${ficha.id}`, "width=1000,height=760");
    if (!popup) return;

    if (ficha.brand === "jugueton") {
      const numeroCotizacion = String(ficha.id).padStart(4, "0");
      const eventDate = new Date(`${ficha.fecha}T00:00:00`);
      const fechaEventoTexto = Number.isNaN(eventDate.getTime())
        ? ficha.fecha
        : eventDate.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
            .replace(/(^.|\s.)/g, (m) => m.toUpperCase());

      const filasJugueton = [
        ...lineasPaquetes.map((l, idx) => ({
          producto: `Paquete ${idx + 1}`,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio: l.subtotal,
        })),
        ...lineasSueltos.map((l, idx) => ({
          producto: `Producto ${idx + 1}`,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio: l.subtotal,
        })),
      ];

      if (inflableDetalle.length > 0) {
        filasJugueton.push({
          producto: "Inflables",
          descripcion: inflableDetalle.join(" | "),
          cantidad: inflableDetalle.length,
          precio: 0,
        });
      }

      filasJugueton.push({
        producto: "Movilidad",
        descripcion: `Entrega y recojo (${escapeHtml(ficha.distrito)})`,
        cantidad: 1,
        precio: 0,
      });

      const bloqueStaff = [
        personalDetalle.length > 0 ? `Personal de staff: ${personalDetalle.join(", ")}` : "Personal de staff: 1 PERSONAL",
        `Duracion del servicio: ${ficha.horasServicio ?? 2} horas`,
        "Incluye instalacion y desmontaje",
        ficha.comentarios ? `Observacion: ${ficha.comentarios}` : "Precio incluye IGB",
      ].join("<br/>");

      filasJugueton.push({
        producto: "OTROS",
        descripcion: bloqueStaff,
        cantidad: 1,
        precio: 0,
      });

      const filasTablaJugueton = filasJugueton
        .map((row) => `
          <tr>
            <td>${escapeHtml(row.producto)}</td>
            <td>${row.descripcion}</td>
            <td class="text-center">${row.cantidad}</td>
            <td class="text-right">${row.precio > 0 ? formatMoney(row.precio) : "-"}</td>
          </tr>
        `)
        .join("");

      const htmlJugueton = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>${defaultFileName}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              background: #ececec;
              color: #0076bf;
            }
            .actions {
              position: sticky;
              top: 0;
              display: flex;
              justify-content: center;
              gap: 8px;
              padding: 10px;
              background: #ececec;
              z-index: 2;
            }
            .btn {
              border: none;
              border-radius: 7px;
              padding: 8px 12px;
              font-size: 13px;
              cursor: pointer;
              color: #fff;
              background: #0076bf;
            }
            .btn.secondary { background: #5f6b75; }
            .sheet {
              width: 210mm;
              min-height: 297mm;
              margin: 12px auto 20px;
              background: #f6f6f6;
              padding: 13mm 11mm;
              box-shadow: 0 10px 24px rgba(0,0,0,0.12);
            }
            .top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 14px;
            }
            .logo {
              width: 180px;
              height: auto;
              object-fit: contain;
            }
            .title-block {
              text-align: right;
              min-width: 250px;
            }
            .title-block h1 {
              margin: 0;
              letter-spacing: 1px;
              font-size: 36px;
              line-height: 0.95;
              color: #0076bf;
            }
            .docno {
              margin-top: 2px;
              font-size: 15px;
              font-weight: 700;
            }
            .inline-box {
              margin-top: 8px;
              border: 1px solid #d6975d;
              display: grid;
              grid-template-columns: 84px 1fr;
            }
            .inline-box span {
              padding: 4px 8px;
              border-right: 1px solid #d6975d;
              font-weight: 700;
              font-size: 17px;
            }
            .inline-box strong {
              padding: 4px 8px;
              font-size: 17px;
              font-weight: 700;
            }
            .info {
              margin-top: 8px;
              font-size: 19px;
              line-height: 1.35;
            }
            .hora-box {
              width: 255px;
              margin: 6px 0 8px auto;
              border: 1px solid #d6975d;
              display: grid;
              grid-template-columns: 84px 1fr;
            }
            .hora-box span,
            .hora-box strong {
              padding: 4px 8px;
              font-size: 17px;
            }
            .hora-box span {
              border-right: 1px solid #d6975d;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 18px;
            }
            th, td {
              border: 1px solid #d6975d;
              padding: 3px 6px;
              vertical-align: top;
            }
            th {
              text-align: left;
              font-size: 19px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals {
              margin-top: 8px;
              width: 255px;
              margin-left: auto;
              border: 1px solid #d6975d;
              border-collapse: collapse;
            }
            .totals .row {
              display: grid;
              grid-template-columns: 1fr 120px;
              border-bottom: 1px solid #d6975d;
              min-height: 34px;
              align-items: center;
            }
            .totals .row:last-child { border-bottom: 0; }
            .totals .label {
              padding: 4px 8px;
              font-size: 20px;
              font-weight: 700;
            }
            .totals .value {
              border-left: 1px solid #d6975d;
              padding: 4px 8px;
              font-size: 20px;
              font-weight: 700;
              text-align: right;
            }
            .legal {
              margin-top: 12px;
              font-size: 14px;
              line-height: 1.2;
            }
            .legal p { margin: 0 0 4px; }
            .legal .highlight { font-weight: 700; }
            .payments {
              margin-top: 14px;
              display: grid;
              grid-template-columns: 1fr 230px;
              gap: 14px;
              align-items: end;
            }
            .payments h3 {
              margin: 0 0 4px;
              font-size: 26px;
              letter-spacing: 0.4px;
            }
            .payments .company {
              margin: 0;
              font-size: 20px;
            }
            .payments .ruc {
              margin: 0 0 8px;
              font-size: 20px;
            }
            .pay-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 18px;
            }
            .pay-table td {
              border: 1px solid #d6975d;
              padding: 4px 6px;
            }
            .signature {
              text-align: center;
              font-size: 23px;
            }
            .signature .line {
              border-top: 2px solid #d6975d;
              margin-bottom: 6px;
            }
            @media print {
              body { background: #fff; }
              .actions { display: none; }
              .sheet {
                margin: 0;
                box-shadow: none;
                width: 100%;
                min-height: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="actions">
            <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
            <button class="btn secondary" onclick="window.close()">Cerrar</button>
          </div>
          <main class="sheet">
            <section class="top">
              <img class="logo" src="/images/jugueton.png" alt="Jugueton" />
              <div class="title-block">
                <h1>COTIZACION</h1>
                <div class="docno">${numeroCotizacion}</div>
                <div class="inline-box">
                  <span>FECHA</span>
                  <strong>${fechaEmision}</strong>
                </div>
              </div>
            </section>

            <section class="info">
              <div><strong>Cliente:</strong> ${escapeHtml(ficha.cliente_nombre)}</div>
              <div><strong>Correo:</strong> ${escapeHtml(ficha.contacto_nombre || "-")}</div>
              <div><strong>Telefono:</strong> ${escapeHtml(ficha.cliente_celular)}</div>
              <div><strong>Direccion del evento:</strong> ${escapeHtml(ficha.direccion)} - ${escapeHtml(ficha.distrito)}</div>
              <div><strong>Fecha del evento:</strong> ${escapeHtml(fechaEventoTexto)}</div>
            </section>

            <div class="hora-box">
              <span>HORA:</span>
              <strong>${escapeHtml(ficha.hora_entrega)} - ${escapeHtml(ficha.hora_recojo)}</strong>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 20%;">Producto</th>
                  <th>Descripcion</th>
                  <th style="width: 12%;" class="text-center">Cantidad</th>
                  <th style="width: 19%;" class="text-right">P. con DSCT</th>
                </tr>
              </thead>
              <tbody>
                ${filasTablaJugueton}
              </tbody>
            </table>

            <section class="totals">
              <div class="row">
                <div class="label">Subtotal</div>
                <div class="value">${formatMoney(total)}</div>
              </div>
              <div class="row">
                <div class="label">Total a Pagar</div>
                <div class="value">${formatMoney(total)}</div>
              </div>
            </section>

            <section class="legal">
              <p>Esta cotizacion tiene una validez de 30 dias. Despues de este tiempo debera solicitar una nueva cotizacion y estara sujeta a variacion de precios.</p>
              <p>Se emiten factura o boleta segun la solicitud del cliente al momento de la reserva.</p>
              <p class="highlight">Puedes reservar con el 50% del monto total y la diferencia un dia antes de tu evento, o con el 100% de si asi lo prefieres.</p>
            </section>

            <section class="payments">
              <div>
                <h3>METODOS DE PAGO</h3>
                <p class="company">DISTRIBUCIONES DISAM E.I.R.L</p>
                <p class="ruc">RUC:20613544250</p>
                <table class="pay-table">
                  <tr><td>Transferencia BCP</td><td>1947106235050</td></tr>
                  <tr><td></td><td>CCI: 00219400710623505090</td></tr>
                  <tr><td>Yape</td><td>906 729 831</td></tr>
                </table>
              </div>
              <div class="signature">
                <div class="line"></div>
                <div>Fernanda Yllescas</div>
                <div style="font-size:20px;">Coordinadora de ventas</div>
              </div>
            </section>
          </main>
        </body>
      </html>
    `;

      popup.document.open();
      popup.document.write(htmlJugueton);
      popup.document.close();
      return;
    }

    const filasDonofrio = [
      ...lineasPaquetes.map((l) => ({
        cantidad: l.cantidad,
        descripcion: l.descripcion,
        pu: l.precioUnitario,
        total: l.subtotal,
        destacado: true,
      })),
      ...lineasSueltos.map((l) => ({
        cantidad: l.cantidad,
        descripcion: l.descripcion,
        pu: 0,
        total: 0,
        destacado: false,
      })),
      ...(carritoDetalle.length > 0
        ? [{
            cantidad: carritoDetalle.length,
            descripcion: `Carritos: ${carritoDetalle.join(" | ")}`,
            pu: 0,
            total: 0,
            destacado: false,
          }]
        : []),
      ...(personalDetalle.length > 0
        ? [{
            cantidad: personalDetalle.length,
            descripcion: `Personal: ${personalDetalle.join(" | ")}`,
            pu: 0,
            total: 0,
            destacado: false,
          }]
        : []),
      {
        cantidad: 1,
        descripcion: `Movilidad a ${ficha.distrito}`,
        pu: 70,
        total: 70,
        destacado: true,
      },
      {
        cantidad: 1,
        descripcion: `Incluye: ${
          ficha.comentarios
            ? ficha.comentarios
            : "Sombrilla, tacho y carrito con sistema de frio."
        }`,
        pu: 0,
        total: 0,
        destacado: false,
      },
    ];

    const filasTablaDonofrio = filasDonofrio
      .map(
        (row) => `
          <tr class="${row.destacado ? "row-highlight" : ""}">
            <td class="cell-right">${row.cantidad}</td>
            <td>${escapeHtml(row.descripcion)}</td>
            <td class="cell-right">${row.pu > 0 ? formatMoney(row.pu) : ""}</td>
            <td class="cell-right">${row.total > 0 ? formatMoney(row.total) : ""}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>${defaultFileName}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #0a2a74;
              background: #efefef;
            }
            .actions {
              position: sticky;
              top: 0;
              display: flex;
              justify-content: center;
              gap: 8px;
              padding: 10px;
              background: #efefef;
              z-index: 3;
            }
            .btn {
              border: none;
              border-radius: 8px;
              padding: 8px 12px;
              font-size: 13px;
              cursor: pointer;
              color: #fff;
              background: #1d4ea4;
            }
            .btn.secondary { background: #6b7280; }
            .sheet {
              width: 210mm;
              min-height: 297mm;
              margin: 14px auto;
              background: #f8f8f8;
              padding: 10mm 10mm 8mm;
              box-shadow: 0 8px 24px rgba(0,0,0,0.12);
              position: relative;
            }
            .bar-top,
            .bar-bottom {
              height: 7mm;
              background: #f1cd19;
            }
            .bar-bottom { margin-top: 7mm; }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin: 6mm 0 5mm;
            }
            .logo {
              width: 170px;
              max-width: 100%;
              height: auto;
              object-fit: contain;
            }
            .company {
              flex: 1;
              text-align: right;
              font-size: 14px;
              line-height: 1.2;
              font-weight: 700;
            }
            .company .line {
              margin-top: 4px;
              border-top: 4px solid #1d4ea4;
              position: relative;
            }
            .company .line::before {
              content: "";
              position: absolute;
              left: 8px;
              top: -8px;
              width: 10px;
              height: 10px;
              background: #1d4ea4;
              transform: rotate(45deg);
            }
            .meta-top {
              display: grid;
              grid-template-columns: 1fr 220px;
              gap: 14px;
              margin-bottom: 4mm;
            }
            .client {
              font-size: 13px;
              line-height: 1.35;
            }
            .client .row {
              display: grid;
              grid-template-columns: 72px 1fr;
              gap: 8px;
              margin-bottom: 2px;
            }
            .quote-box {
              font-size: 13px;
              font-weight: 700;
            }
            .quote-box .row {
              display: grid;
              grid-template-columns: 88px 1fr;
              margin-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #111;
              padding: 3px 4px;
              vertical-align: top;
            }
            th {
              text-align: center;
              background: #ffffff;
              font-size: 13px;
              font-weight: 700;
            }
            .row-highlight td {
              background: #eb872a;
              color: #111;
              font-weight: 700;
            }
            .cell-right {
              text-align: right;
              white-space: nowrap;
            }
            .total-row td {
              background: #eb872a;
              font-weight: 700;
            }
            .legal {
              margin-top: 12mm;
              font-size: 13px;
              color: #111;
              line-height: 1.35;
            }
            .footer-info {
              margin-top: 8mm;
              display: grid;
              grid-template-columns: 1fr 1.2fr;
              gap: 14px;
              align-items: end;
            }
            .seller {
              font-size: 14px;
              color: #0f172a;
              line-height: 1.4;
            }
            .accounts {
              width: 100%;
              font-size: 12px;
            }
            .accounts td {
              border: 1px solid #111;
              padding: 3px 4px;
              color: #111;
            }
            .brand-footer {
              margin-top: 6mm;
              border-top: 4px solid #1d4ea4;
              border-bottom: 4px solid #ef8f21;
              padding: 4px 0;
              color: #1d4ea4;
              font-size: 12px;
              display: flex;
              justify-content: space-between;
              gap: 12px;
            }
            @media print {
              body { background: #fff; }
              .actions { display: none; }
              .sheet {
                margin: 0;
                box-shadow: none;
                width: 100%;
                min-height: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="actions">
            <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
            <button class="btn secondary" onclick="window.close()">Cerrar</button>
          </div>
          <main class="sheet">
            <div class="bar-top"></div>

            <header class="header">
              <img class="logo" src="/images/eventos_ap.png" alt="Eventos AP" />
              <div class="company">
                <div>DISTRIBUCIONES Y CONCESIONES AP EIRL</div>
                <div>RUC: 20556840149</div>
                <div class="line"></div>
              </div>
            </header>

            <section class="meta-top">
              <div class="client">
                <div class="row"><strong>SR(A)</strong><span>${escapeHtml(ficha.cliente_nombre)}</span></div>
                <div class="row"><strong>RUC / DNI</strong><span>${escapeHtml(ficha.cliente_celular || "-")}</span></div>
                <div class="row"><strong>CORREO</strong><span>${escapeHtml(ficha.contacto_nombre || "-")}</span></div>
                <div class="row"><strong>Atencion</strong><span>${escapeHtml(ficha.contacto_nombre || ficha.cliente_nombre)}</span></div>
                <div class="row"><strong></strong><span>Mediante la presente, enviamos lo solicitado:</span></div>
              </div>
              <div class="quote-box">
                <div class="row"><span>COTIZACION:</span><span>${numeroFicha}</span></div>
                <div class="row"><span>DISTRITO:</span><span>${escapeHtml(ficha.distrito)}</span></div>
                <div class="row"><span>FECHA:</span><span>${fechaEmision}</span></div>
              </div>
            </section>

            <table>
              <thead>
                <tr>
                  <th style="width: 16%;">CANTIDAD</th>
                  <th>DESCRIPCION</th>
                  <th style="width: 13%;">P/U</th>
                  <th style="width: 14%;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${filasTablaDonofrio}
                <tr class="total-row">
                  <td></td>
                  <td>MONTO TOTAL INCLUIDO IGV</td>
                  <td></td>
                  <td class="cell-right">${formatMoney(total)}</td>
                </tr>
              </tbody>
            </table>

            <section class="legal">
              <div>Se emiten factura o boleta segun la solicitud del cliente al momento de la reserva.</div>
              <div>Forma de pago: para separar el pedido puede ser con el 100% o un adelanto del 50% del monto total.</div>
              <div>El saldo restante debera ser cancelado a mas tardar al momento de la entrega.</div>
            </section>

            <section class="footer-info">
              <div class="seller">
                <div><strong>YANELA CASTILLO</strong></div>
                <div>Coordinadora de ventas</div>
                <div>Celular: 991 980 588</div>
              </div>
              <table class="accounts">
                <tbody>
                  <tr><td>Yape</td><td>991980588</td></tr>
                  <tr><td>BCP</td><td>19472414931093</td></tr>
                  <tr><td>CCI</td><td>00219417241493109394</td></tr>
                  <tr><td>BBVA</td><td>1105080100018200</td></tr>
                  <tr><td>CCI</td><td>01150800010001820094</td></tr>
                </tbody>
              </table>
            </section>

            <section class="brand-footer">
              <span>www.donofrioeventos.com | ventas@eventosdonofrio.pe</span>
              <span>991 980 588</span>
            </section>

            <div class="bar-bottom"></div>
          </main>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const handleTogglePersonal = (personalId: number) => {
    setFormData(prev => {
      const ids = prev.personalIds;
      return { ...prev, personalIds: ids.includes(personalId) ? ids.filter(id => id !== personalId) : [...ids, personalId] };
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddFormPaquete = () => {
    setFormData(prev => ({ ...prev, paquetes: [...prev.paquetes, { paqueteId: 0, paqueteNombre: "", paqueteTipo: "", cantidad: 1 }] }));
  };
  const handleRemoveFormPaquete = (idx: number) => {
    setFormData(prev => ({ ...prev, paquetes: prev.paquetes.filter((_, i) => i !== idx) }));
  };
  const handlePaqueteChange = (idx: number, paqueteId: number) => {
    const paq = paquetesDisponibles.find(p => p.id === paqueteId);
    if (!paq) return;
    setFormData(prev => ({
      ...prev,
      paquetes: prev.paquetes.map((p, i) => i === idx ? { ...p, paqueteId: paq.id, paqueteNombre: paq.nombre, paqueteTipo: paq.tipo } : p)
    }));
  };
  const handlePaqueteCantidadChange = (idx: number, cantidad: number) => {
    setFormData(prev => ({
      ...prev,
      paquetes: prev.paquetes.map((p, i) => i === idx ? { ...p, cantidad } : p)
    }));
  };
  const handleAddProductoSuelto = () => {
    setFormData(prev => ({ ...prev, productosSueltos: [...prev.productosSueltos, { productoNombre: "", cantidad: 0 }] }));
  };
  const handleRemoveProductoSuelto = (idx: number) => {
    setFormData(prev => ({ ...prev, productosSueltos: prev.productosSueltos.filter((_, i) => i !== idx) }));
  };

  const handleToggleCarrito = (carritoId: number) => {
    setFormData(prev => {
      const ids = prev.carritoIds;
      return { ...prev, carritoIds: ids.includes(carritoId) ? ids.filter(id => id !== carritoId) : [...ids, carritoId] };
    });
  };

  const handleToggleInflable = (inflableId: number) => {
    setFormData(prev => {
      const ids = prev.inflableIds;
      return { ...prev, inflableIds: ids.includes(inflableId) ? ids.filter(id => id !== inflableId) : [...ids, inflableId] };
    });
  };

  const handleAddAbono = async (fichaId: number, abono: Abono) => {
    await apiRequest(`/fichas/${fichaId}/abonos`, {
      method: "POST",
      body: JSON.stringify({
        fecha: abono.fecha,
        monto: abono.monto,
        numero_operacion: abono.numeroOperacion || null,
        comprobante_url: abono.comprobante || null,
        medio: abono.medio,
      }),
    });

    await loadFichas();
    if (selectedFicha && selectedFicha.id === fichaId) {
      const refreshed = await apiRequest<any>(`/fichas/${fichaId}`);
      setSelectedFicha((prev) => prev ? {
        ...prev,
        abonos: (refreshed.abonos || []).map((a: any) => ({
          id: a.id,
          fecha: a.fecha,
          monto: Number(a.monto || 0),
          numeroOperacion: a.numero_operacion || "",
          comprobante: a.comprobante_url || "",
          medio: a.medio,
        })),
      } : prev);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;

    try {
      await apiRequest("/fichas", {
        method: "POST",
        body: JSON.stringify({
          fecha: formData.fecha,
          distrito: formData.distrito,
          direccion: formData.direccion,
          referencia: formData.referencia,
          hora_entrega: formData.hora_entrega,
          hora_recojo: formData.hora_recojo,
          comentarios: formData.comentarios,
          horas_servicio: brand === "jugueton" ? Number(formData.horasServicio) || 2 : null,
          cliente_nombre: formData.cliente_nombre,
          cliente_celular: formData.cliente_celular,
          contacto_nombre: formData.contacto_nombre,
          contacto_celular: formData.contacto_celular,
          cotizacion: Number(formData.cotizacion),
          descuento: Number(formData.descuento),
          brand,
          paquetes: formData.paquetes.filter(p => p.paqueteId > 0),
          productosSueltos: formData.productosSueltos.filter(p => p.productoNombre && p.cantidad > 0),
          carritoIds: formData.carritoIds,
          inflableIds: brand === "jugueton" ? formData.inflableIds : [],
          personalIds: formData.personalIds,
        }),
      });

      setShowAddModal(false);
      setFormData(getInitialFormData());
      await loadFichas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la ficha");
    }
  };

  const handleCloseModal = () => { setShowAddModal(false); setFormData(getInitialFormData()); };

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent";

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Fichas de Eventos</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestiona eventos, pagos parciales y control financiero</p>
      </div>

      {/* Financial + Operational Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-xs text-gray-500 dark:text-gray-400">Eventos</span></div>
          <p className="text-2xl text-gray-900 dark:text-white">{loading ? "..." : fichas.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-xs text-gray-500 dark:text-gray-400">Venta Total</span></div>
          <p className="text-2xl text-gray-900 dark:text-white">{formatMoney(stats.ventaTotal)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-green-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Cobrado</span></div>
          <p className="text-2xl text-green-600 dark:text-green-400">{formatMoney(stats.totalAbonado)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Por Cobrar</span></div>
          <p className="text-2xl text-red-500">{formatMoney(stats.saldoPendiente)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Pagadas</span></div>
          <p className="text-2xl text-green-600 dark:text-green-400">{stats.pagadas}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><CircleDashed className="w-4 h-4 text-[#EF8022]" /><span className="text-xs text-gray-500 dark:text-gray-400">Parciales</span></div>
          <p className="text-2xl text-[#EF8022]">{stats.parciales}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Pendientes</span></div>
          <p className="text-2xl text-red-500">{stats.pendientes}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <DateRangePicker selectedRange={dateRange} onRangeChange={setDateRange} onClear={() => setDateRange(undefined)} />
        </div>
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex-1 w-full lg:max-w-md">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Buscar por cliente, dirección o distrito..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <select value={selectedDistrito} onChange={e => setSelectedDistrito(e.target.value)}
              className="flex-1 lg:flex-none px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent text-sm">
              {distritos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value as typeof estadoFilter)}
              className="flex-1 lg:flex-none px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent text-sm">
              <option value="Todos">Estado: Todos</option>
              <option value="pagado">Pagado</option>
              <option value="parcial">Parcial</option>
              <option value="pendiente">Pendiente</option>
            </select>
            <button onClick={() => setShowAddModal(true)}
              className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap text-sm">
              <Plus className="w-5 h-5" /> Nueva Ficha
            </button>
          </div>
        </div>
      </div>

      {/* Fichas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredFichas.map(ficha => {
          const estado = getEstadoPago(ficha);
          const total = getTotal(ficha);
          const abonado = getTotalAbonado(ficha);
          const pctPagado = total > 0 ? Math.min(100, (abonado / total) * 100) : 0;
          const unidadesHelado = getUnidadesHelado(ficha);
          const brandMeta = getBrandMeta(ficha.brand);

          return (
            <div key={ficha.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{ficha.fecha}</span>
                    <EstadoPagoBadge estado={estado} />
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${brandMeta.badgeClass}`}>
                      <img src={brandMeta.logoUrl} alt={brandMeta.label} className={brandMeta.logoClass} />
                      {brandMeta.label}
                    </span>
                  </div>
                  <h3 className="text-lg text-gray-900 dark:text-white mb-1 truncate">{ficha.cliente_nombre}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" /> {ficha.cliente_celular}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleGenerarProforma(ficha)}
                    className="p-2 text-gray-400 hover:text-[#1F3C8B] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Generar proforma"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button onClick={() => { setAbonoTargetFicha(ficha); setShowAbonoModal(true); }}
                    className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    title="Registrar abono">
                    <CreditCard className="w-5 h-5" />
                  </button>
                  <button onClick={() => { setSelectedFicha(ficha); setShowDetailModal(true); }}
                    className="p-2 text-gray-400 hover:text-[#EF8022] hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Paquetes badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {ficha.paquetes.map((paq, idx) => (
                  <span key={idx} className={`px-2.5 py-1 rounded-full text-xs ${getPaqueteColor(paq.paqueteTipo)}`}>
                    {paq.cantidad > 1 && `${paq.cantidad}x `}{paq.paqueteNombre}
                  </span>
                ))}
                {ficha.productosSueltos.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs bg-[#EF8022]/10 text-[#EF8022] dark:bg-[#EF8022]/20">
                    +{ficha.productosSueltos.reduce((s, p) => s + p.cantidad, 0)} adicionales
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {unidadesHelado} unid. helado
                </span>
              </div>

              {/* Location */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{ficha.direccion}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{ficha.distrito}</p>
                  </div>
                </div>
              </div>

              {/* Financial summary card */}
              <div className="bg-gradient-to-r from-[#1F3C8B]/5 to-[#EF8022]/5 dark:from-[#1F3C8B]/10 dark:to-[#EF8022]/10 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Cotización</span>
                  <span className="text-sm text-gray-900 dark:text-white">{formatMoney(ficha.cotizacion)}</span>
                </div>
                {ficha.descuento > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-red-500">Descuento</span>
                    <span className="text-sm text-red-500">-{formatMoney(ficha.descuento)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-600 dark:text-gray-300">Abonado ({ficha.abonos.length} pago{ficha.abonos.length !== 1 ? "s" : ""})</span>
                  <span className="text-sm text-green-600 dark:text-green-400">{formatMoney(abonado)}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-1">
                  <div className={`h-2 rounded-full transition-all ${estado === "pagado" ? "bg-green-500" : estado === "parcial" ? "bg-[#EF8022]" : "bg-red-400"}`}
                    style={{ width: `${pctPagado}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{pctPagado.toFixed(0)}% pagado</span>
                  <span className={`text-xs ${getSaldo(ficha) > 0 ? "text-red-500" : "text-green-500"}`}>
                    Saldo: {formatMoney(Math.max(0, getSaldo(ficha)))}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 text-sm pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1"><Clock className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-gray-600 dark:text-gray-400">{ficha.hora_entrega}-{ficha.hora_recojo}</span></div>
                {(ficha.carritoIds?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1"><PackageIcon className="w-4 h-4 text-gray-400" /><span className="text-gray-600 dark:text-gray-400">{ficha.carritoIds!.length}c</span></div>
                )}
                {ficha.brand === "jugueton" && (ficha.inflableIds?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1"><Wind className="w-4 h-4 text-gray-400" /><span className="text-gray-600 dark:text-gray-400">{ficha.inflableIds!.length}i</span></div>
                )}
                <div className="flex items-center gap-1"><User className="w-4 h-4 text-gray-400" /><span className="text-gray-600 dark:text-gray-400">{(ficha.personalIds ?? []).length}p</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reporte de unidades de helado por ficha */}
      {filteredFichas.length > 0 && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg text-gray-900 dark:text-white mb-1">Reporte de Unidades de Helado por Ficha</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Total unidades en el filtro actual: {filteredFichas.reduce((sum, f) => sum + getUnidadesHelado(f), 0)}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Ficha</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Marca</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Unidades Helado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredFichas.map(ficha => (
                  (() => {
                    const meta = getBrandMeta(ficha.brand);
                    return (
                      <tr key={ficha.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">#{ficha.id}</td>
                        <td className="py-3 px-3 text-gray-900 dark:text-white">{ficha.cliente_nombre}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
                            <img src={meta.logoUrl} alt={meta.label} className={meta.logoClass} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900 dark:text-white">{getUnidadesHelado(ficha)}</td>
                      </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredFichas.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No se encontraron fichas</p>
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────── */}
      {showDetailModal && selectedFicha && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl text-gray-900 dark:text-white mb-2">Detalle del Evento</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-600 dark:text-gray-400">{selectedFicha.fecha}</span></div>
                  <EstadoPagoBadge estado={getEstadoPago(selectedFicha)} />
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-6">
              {/* Cliente */}
              <div>
                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-3">Información del Cliente</h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-gray-900 dark:text-white">{selectedFicha.cliente_nombre}</span></div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-gray-900 dark:text-white">{selectedFicha.cliente_celular}</span></div>
                  {selectedFicha.contacto_nombre && (
                    <>
                      <div className="border-t border-gray-200 dark:border-gray-600 my-2 pt-2"><p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Contacto Alternativo</p></div>
                      <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">{selectedFicha.contacto_nombre}</span></div>
                      {selectedFicha.contacto_celular && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">{selectedFicha.contacto_celular}</span></div>}
                    </>
                  )}
                </div>
              </div>

              {/* ── FINANCIAL SECTION ──────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Resumen Financiero</h4>
                  <button
                    onClick={() => { setAbonoTargetFicha(selectedFicha); setShowAbonoModal(true); }}
                    className="text-xs text-[#EF8022] hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Registrar Abono
                  </button>
                </div>
                <div className="bg-gradient-to-r from-[#1F3C8B]/5 to-[#EF8022]/5 dark:from-[#1F3C8B]/10 dark:to-[#EF8022]/10 rounded-lg p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cotización</p>
                      <p className="text-lg text-gray-900 dark:text-white">{formatMoney(selectedFicha.cotizacion)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Descuento</p>
                      <p className="text-lg text-red-500">{selectedFicha.descuento > 0 ? `-${formatMoney(selectedFicha.descuento)}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total a Pagar</p>
                      <p className="text-lg text-[#1F3C8B] dark:text-blue-400">{formatMoney(getTotal(selectedFicha))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo</p>
                      <p className={`text-lg ${getSaldo(selectedFicha) > 0 ? "text-red-500" : "text-green-500"}`}>{formatMoney(Math.max(0, getSaldo(selectedFicha)))}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mb-2">
                    <div className={`h-2.5 rounded-full transition-all ${getEstadoPago(selectedFicha) === "pagado" ? "bg-green-500" : getEstadoPago(selectedFicha) === "parcial" ? "bg-[#EF8022]" : "bg-red-400"}`}
                      style={{ width: `${getTotal(selectedFicha) > 0 ? Math.min(100, (getTotalAbonado(selectedFicha) / getTotal(selectedFicha)) * 100) : 0}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 text-right">{getTotalAbonado(selectedFicha) > 0 ? `${((getTotalAbonado(selectedFicha) / getTotal(selectedFicha)) * 100).toFixed(0)}% pagado` : "Sin abonos"}</p>
                </div>

                {/* Abonos history */}
                {selectedFicha.abonos.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Historial de Abonos ({selectedFicha.abonos.length})</h5>
                    <div className="space-y-2">
                      {selectedFicha.abonos.map(abono => (
                        <div key={abono.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                            <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-900 dark:text-white">{formatMoney(abono.monto)}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{abono.fecha}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{abono.medio}</span>
                              {abono.numeroOperacion && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">#{abono.numeroOperacion}</span>
                              )}
                              {abono.comprobante && (
                                <span className="text-xs text-[#EF8022] flex items-center gap-0.5"><Receipt className="w-3 h-3" /> Comp.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Paquetes */}
              <div>
                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-3">Paquetes Asignados</h4>
                <div className="mb-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Total helados: {getUnidadesHelado(selectedFicha)} unidades
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedFicha.paquetes.map((paq, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getPaqueteColor(paq.paqueteTipo)}`}><Layers className="w-4 h-4" /></div>
                        <div>
                          <p className="text-gray-900 dark:text-white">{paq.paqueteNombre}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getPaqueteColor(paq.paqueteTipo)}`}>{paq.paqueteTipo}</span>
                        </div>
                      </div>
                      <span className="text-lg text-gray-900 dark:text-white">x{paq.cantidad}</span>
                    </div>
                  ))}
                </div>
                {selectedFicha.productosSueltos.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-3">Productos Adicionales</h4>
                    <div className="bg-[#EF8022]/5 dark:bg-[#EF8022]/10 rounded-lg p-4">
                      <div className="space-y-2">
                        {selectedFicha.productosSueltos.map((prod, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-[#EF8022]" /><span className="text-gray-900 dark:text-white">{prod.productoNombre}</span></div>
                            <span className="text-gray-600 dark:text-gray-400 font-mono">x{prod.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ubicación + Horarios + Recursos */}
              <div>
                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-3">Ubicación</h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-red-500 mt-0.5" /><div><p className="text-gray-900 dark:text-white">{selectedFicha.direccion}</p><p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedFicha.distrito}</p>{selectedFicha.referencia && <p className="text-sm text-gray-500 mt-2 italic">Ref: {selectedFicha.referencia}</p>}</div></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1F3C8B]/5 dark:bg-[#1F3C8B]/10 rounded-lg p-4"><div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-xs text-gray-600 dark:text-gray-400">Entrega</span></div><p className="text-xl text-gray-900 dark:text-white">{selectedFicha.hora_entrega}</p></div>
                <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4"><div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-red-500" /><span className="text-xs text-gray-600 dark:text-gray-400">Recojo</span></div><p className="text-xl text-gray-900 dark:text-white">{selectedFicha.hora_recojo}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Registrado por:</span>
                  {(() => {
                    const meta = getBrandMeta(selectedFicha.brand);
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
                        <img src={meta.logoUrl} alt={meta.label} className={meta.logoClass} />
                        {meta.label}
                      </span>
                    );
                  })()}
                </div>
                {(selectedFicha.carritoIds?.length ?? 0) > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 col-span-2">
                    <div className="flex items-center gap-2 mb-2"><PackageIcon className="w-4 h-4 text-[#EF8022]" /><span className="text-xs text-gray-600 dark:text-gray-400">Carritos Asignados</span></div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFicha.carritoIds!.map(id => {
                        const c = carritos.find(c => c.id === id);
                        return c ? <span key={id} className="text-xs px-2 py-1 rounded-full bg-[#EF8022]/10 text-[#EF8022] dark:bg-[#EF8022]/20">{c.codigo} — {c.modelo}</span> : null;
                      })}
                    </div>
                  </div>
                )}
                {selectedFicha.brand === "jugueton" && (selectedFicha.inflableIds?.length ?? 0) > 0 && (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 col-span-2">
                      <div className="flex items-center gap-2 mb-2"><Wind className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-xs text-gray-600 dark:text-gray-400">Inflables Asignados</span></div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedFicha.inflableIds!.map(id => {
                          const inf = inflables.find(i => i.id === id);
                          return inf ? <span key={id} className="text-xs px-2 py-1 rounded-full bg-[#1F3C8B]/10 text-[#1F3C8B] dark:bg-[#1F3C8B]/20 dark:text-blue-400">{inf.nombre}</span> : null;
                        })}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"><div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-[#EF8022]" /><span className="text-xs text-gray-600 dark:text-gray-400">Horas</span></div><p className="text-xl text-gray-900 dark:text-white">{selectedFicha.horasServicio}h</p></div>
                  </>
                )}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 col-span-2"><div className="flex items-center gap-2 mb-2"><User className="w-4 h-4 text-[#EF8022]" /><span className="text-xs text-gray-600 dark:text-gray-400">Personal Asignado</span></div><div className="flex flex-wrap gap-1.5">{getNombresPersonal(selectedFicha).length > 0 ? getNombresPersonal(selectedFicha).map(nombre => <span key={nombre} className="text-xs px-2 py-1 rounded-full bg-[#EF8022]/10 text-[#EF8022] dark:bg-[#EF8022]/20">{nombre}</span>) : <span className="text-xs text-gray-400">Sin personal asignado</span>}</div></div>
              </div>
              {selectedFicha.comentarios && (
                <div><h4 className="text-sm text-gray-500 dark:text-gray-400 mb-3">Comentarios</h4><div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"><p className="text-gray-900 dark:text-white">{selectedFicha.comentarios}</p></div></div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleGenerarProforma(selectedFicha)}
                className="flex-1 bg-[#1F3C8B] text-white py-3 rounded-lg hover:bg-[#19316f] transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <FileText className="w-4 h-4" /> Generar Proforma
              </button>
              <button onClick={() => { setAbonoTargetFicha(selectedFicha); setShowAbonoModal(true); }}
                className="flex-1 bg-[#EF8022] text-white py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center justify-center gap-2 text-sm">
                <CreditCard className="w-4 h-4" /> Registrar Abono
              </button>
              <button onClick={() => setShowDetailModal(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Modal ─────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <h3 className="text-2xl text-gray-900 dark:text-white">Nueva Ficha de Evento</h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Fecha */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /> Información del Evento</h4>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Fecha *</label>
                  <input type="date" name="fecha" value={formData.fecha} onChange={handleInputChange} required className={`${inputClass} max-w-xs`} />
                </div>
              </div>

              {/* Paquetes */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-[#EF8022]" /> Paquetes del Evento</h4>
                <div className="space-y-3">
                  {formData.paquetes.map((paq, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Paquete</label>
                        <select value={paq.paqueteId} onChange={e => handlePaqueteChange(idx, Number(e.target.value))}
                          className={`${inputClass} text-sm`}>
                          <option value={0}>Seleccionar paquete...</option>
                          {paquetesDisponibles.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre} ({p.tipo}) {p.precio > 0 ? `- S/${p.precio}` : "- A cotizar"}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cantidad</label>
                        <input type="number" value={paq.cantidad} onChange={e => handlePaqueteCantidadChange(idx, Number(e.target.value))} min={1}
                          className={`${inputClass} text-sm`} />
                      </div>
                      {formData.paquetes.length > 1 && (
                        <button type="button" onClick={() => handleRemoveFormPaquete(idx)} className="mt-5 p-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={handleAddFormPaquete} className="text-sm text-[#EF8022] hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar otro paquete</button>
                </div>
              </div>

              {/* Productos sueltos */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-[#EF8022]" /> Productos Adicionales</h4>
                {formData.productosSueltos.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">Sin productos adicionales.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.productosSueltos.map((prod, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select value={prod.productoNombre}
                          onChange={e => {
                            const items = [...formData.productosSueltos];
                            items[idx] = { ...items[idx], productoNombre: e.target.value };
                            setFormData(prev => ({ ...prev, productosSueltos: items }));
                          }}
                          className={`${inputClass} flex-1 text-sm`}>
                          <option value="">Seleccionar producto...</option>
                          {productNames.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input type="number" value={prod.cantidad || ""}
                          onChange={e => {
                            const items = [...formData.productosSueltos];
                            items[idx] = { ...items[idx], cantidad: Number(e.target.value) };
                            setFormData(prev => ({ ...prev, productosSueltos: items }));
                          }}
                          placeholder="Cant." min={0} className={`${inputClass} w-20 text-sm`} />
                        <button type="button" onClick={() => handleRemoveProductoSuelto(idx)} className="p-2 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={handleAddProductoSuelto} className="mt-2 text-sm text-[#EF8022] hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar producto suelto</button>
              </div>

              {/* ── FINANCIAL FIELDS ──────────────────────────── */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /> Cotización y Descuento</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Cotización Total (S/) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">S/</span>
                      <input type="number" name="cotizacion" value={formData.cotizacion || ""} onChange={handleInputChange} required min={0} step={0.01}
                        className={`${inputClass} pl-9`} placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Descuento (S/)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">S/</span>
                      <input type="number" name="descuento" value={formData.descuento || ""} onChange={handleInputChange} min={0} step={0.01}
                        className={`${inputClass} pl-9`} placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Total a Pagar</label>
                    <div className="flex items-center h-[42px] px-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <span className="text-lg text-[#1F3C8B] dark:text-blue-400">
                        {formatMoney(Math.max(0, (Number(formData.cotizacion) || 0) - (Number(formData.descuento) || 0)))}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Los abonos se registran después de crear la ficha, desde el detalle del evento.</p>
              </div>

              {/* Cliente */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /> Información del Cliente</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Nombre del Cliente *</label><input type="text" name="cliente_nombre" value={formData.cliente_nombre} onChange={handleInputChange} required placeholder="Ej: María López" className={inputClass} /></div>
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Celular del Cliente *</label><input type="tel" name="cliente_celular" value={formData.cliente_celular} onChange={handleInputChange} required placeholder="Ej: 999 888 777" className={inputClass} /></div>
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Contacto Alternativo</label><input type="text" name="contacto_nombre" value={formData.contacto_nombre} onChange={handleInputChange} placeholder="Ej: Juan Pérez" className={inputClass} /></div>
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Celular del Contacto</label><input type="tel" name="contacto_celular" value={formData.contacto_celular} onChange={handleInputChange} placeholder="Ej: 988 777 666" className={inputClass} /></div>
                </div>
              </div>

              {/* Ubicación */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> Ubicación</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Distrito *</label>
                    <select name="distrito" value={formData.distrito} onChange={handleInputChange} required className={inputClass}>
                      <option value="">Seleccionar distrito</option>
                      {DISTRITOS_LIMA.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Dirección *</label><input type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} required placeholder="Ej: Av. Principal 123" className={inputClass} /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Referencia</label><input type="text" name="referencia" value={formData.referencia} onChange={handleInputChange} placeholder="Ej: Frente al parque" className={inputClass} /></div>
                </div>
              </div>

              {/* Horarios */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /> Horarios</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Hora de Entrega *</label><input type="time" name="hora_entrega" value={formData.hora_entrega} onChange={handleInputChange} required className={inputClass} /></div>
                  <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Hora de Recojo *</label><input type="time" name="hora_recojo" value={formData.hora_recojo} onChange={handleInputChange} required className={inputClass} /></div>
                </div>
              </div>

              {/* Recursos */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><PackageIcon className="w-4 h-4 text-[#EF8022]" /> Recursos</h4>
                <div className="space-y-4">
                  {/* Carritos - ambas marcas */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Carritos</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {carritos.map(carrito => (
                        <label key={carrito.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.carritoIds.includes(carrito.id) ? 'border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'} ${carrito.estado === 'mantenimiento' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input type="checkbox" checked={formData.carritoIds.includes(carrito.id)} onChange={() => carrito.estado !== 'mantenimiento' && handleToggleCarrito(carrito.id)} className="w-4 h-4 accent-[#EF8022]" disabled={carrito.estado === 'mantenimiento'} />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white truncate">{carrito.codigo} — {carrito.modelo}</p>
                            <p className={`text-xs ${carrito.estado === 'disponible' ? 'text-green-500' : carrito.estado === 'en-uso' ? 'text-orange-500' : 'text-red-500'}`}>{carrito.estado}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* Inflables - solo Jugueton */}
                  {brand === "jugueton" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Inflables</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {inflables.map(inflable => (
                            <label key={inflable.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.inflableIds.includes(inflable.id) ? 'border-[#1F3C8B] bg-[#1F3C8B]/5 dark:bg-[#1F3C8B]/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                              <input type="checkbox" checked={formData.inflableIds.includes(inflable.id)} onChange={() => handleToggleInflable(inflable.id)} className="w-4 h-4 accent-[#1F3C8B]" />
                              <div className="min-w-0">
                                <p className="text-sm text-gray-900 dark:text-white truncate">{inflable.nombre}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{inflable.cantidadTotal} unid. · S/{inflable.precioAlquiler}/día</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Horas de Servicio *</label><input type="number" name="horasServicio" value={formData.horasServicio || 2} onChange={handleInputChange} required min="1" step="0.5" className={inputClass} /></div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Personal (global) *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {personales.map(personal => (
                        <label key={personal.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.personalIds.includes(personal.id) ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10" : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                          <input
                            type="checkbox"
                            checked={formData.personalIds.includes(personal.id)}
                            onChange={() => handleTogglePersonal(personal.id)}
                            className="w-4 h-4 accent-[#EF8022]"
                          />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white truncate">{personal.nombre}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{personal.rol} · {personal.estado}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Seleccionados: {formData.personalIds.length}</p>
                  </div>
                </div>
              </div>

              {/* Comentarios */}
              <div>
                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><Edit className="w-4 h-4 text-gray-400" /> Comentarios</h4>
                <textarea name="comentarios" value={formData.comentarios} onChange={handleInputChange} rows={3} placeholder="Notas especiales o instrucciones" className={inputClass} />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="submit" className="flex-1 bg-[#EF8022] text-white py-3 rounded-lg hover:bg-[#d9711c] transition-colors text-sm">Guardar Ficha</button>
                <button type="button" onClick={handleCloseModal} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Abono Modal ───────────────────────────────────────── */}
      {showAbonoModal && abonoTargetFicha && (
        <AbonoModal
          ficha={abonoTargetFicha}
          onClose={() => { setShowAbonoModal(false); setAbonoTargetFicha(null); }}
          onSave={handleAddAbono}
        />
      )}
    </div>
  );
}
