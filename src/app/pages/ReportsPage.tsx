import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, CalendarClock, Download, Loader2, Minus, Pencil, Table2, BarChart3, Target, Truck, Users, Wallet,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import { getLocalDateString, parseLocalDate } from "../lib/date";
import { obtenerAsignaciones, obtenerClientes, obtenerFichasConDetalle } from "../lib/queries";
import { StatCard } from "../components/ui/stat-card";
import { useProducts } from "../contexts/ProductsContext";
import { useBrand } from "../contexts/BrandContext";
import { useTheme } from "../contexts/ThemeContext";
import { construirLineasCotizacion, origenDesdeDetalleApi, toMoneyNumber } from "../lib/cotizacion";
import { isAdminUser } from "../lib/auth";
import { CuotaGauge, colorDeAvance } from "../components/CuotaGauge";
import { PageHeader } from "../components/ui/page-header";
import { Button } from "../components/ui/button";
import { campoCompacto } from "../lib/ui";

// ── Utilidades de fecha y formato ─────────────────────────────────

type Modo = "month" | "day" | "range";
type CuotaMensual = { monto: number | null; heredada: boolean; mes_origen: string | null };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const nombreMes = (mes: string) => {
  const [year, month] = mes.split("-");
  const idx = Number(month) - 1;
  return idx >= 0 && idx <= 11 ? `${MESES[idx]} ${year}` : mes;
};

// La API devuelve fechas como medianoche UTC ("2026-10-10T00:00:00.000Z"); se usa solo "YYYY-MM-DD"
const dia = (valor: unknown) => String(valor || "").slice(0, 10);
const fechaVentaDe = (f: any) => dia(f?.fecha_reserva || f?.fecha);
const fechaEventoDe = (f: any) => dia(f?.fecha_evento || f?.fecha);

function sumarDias(fecha: string, dias: number) {
  const d = parseLocalDate(fecha);
  d.setDate(d.getDate() + dias);
  return getLocalDateString(d);
}

function diasEntre(desde: string, hasta: string) {
  return Math.round((parseLocalDate(hasta).getTime() - parseLocalDate(desde).getTime()) / 86_400_000) + 1;
}

// Período elegido y el inmediatamente anterior de la misma duración (para comparar)
function calcularPeriodo(modo: Modo, mes: string, diaSel: string, desdeSel: string, hastaSel: string) {
  if (modo === "month" && mes) {
    const [y, m] = mes.split("-").map(Number);
    const desde = `${mes}-01`;
    const hasta = getLocalDateString(new Date(y, m, 0));
    const prevDesde = getLocalDateString(new Date(y, m - 2, 1));
    const prevHasta = getLocalDateString(new Date(y, m - 1, 0));
    return { desde, hasta, prevDesde, prevHasta, comparacion: "mes anterior" };
  }
  if (modo === "day") {
    return { desde: diaSel, hasta: diaSel, prevDesde: sumarDias(diaSel, -1), prevHasta: sumarDias(diaSel, -1), comparacion: "día anterior" };
  }
  const desde = desdeSel <= hastaSel ? desdeSel : hastaSel;
  const hasta = desdeSel <= hastaSel ? hastaSel : desdeSel;
  const largo = diasEntre(desde, hasta);
  return { desde, hasta, prevDesde: sumarDias(desde, -largo), prevHasta: sumarDias(desde, -1), comparacion: "período anterior" };
}

const enRango = (fecha: string, desde: string, hasta: string) => !!fecha && fecha >= desde && fecha <= hasta;

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const solesEje = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })}k` : String(Math.round(n)));
const entero = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 0 });
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;

const etiquetaMedio = (medio: string) => {
  const limpio = (medio || "Sin medio").replace(/_/g, " ").trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
};

const horaCorta = (hora?: string) => {
  if (!hora) return "—";
  const [h, m] = hora.split(":").map(Number);
  if (Number.isNaN(h)) return hora;
  const sufijo = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")}${sufijo}`;
};

// Top N y el resto agrupado como "Otros", para no pasar de ~8 barras
function topConOtros<T extends { etiqueta: string; valor: number }>(filas: T[], n = 8) {
  const orden = [...filas].sort((a, b) => b.valor - a.valor);
  if (orden.length <= n) return orden;
  const resto = orden.slice(n - 1).reduce((s, f) => s + f.valor, 0);
  return [...orden.slice(0, n - 1), { etiqueta: "Otros", valor: resto } as T];
}

function agrupar<T>(items: T[], clave: (i: T) => string, valor: (i: T) => number) {
  const map = new Map<string, number>();
  items.forEach((i) => map.set(clave(i), (map.get(clave(i)) || 0) + valor(i)));
  return Array.from(map.entries()).map(([etiqueta, v]) => ({ etiqueta, valor: v }));
}

// ── Colores de gráficos (un solo tono por serie; claro y oscuro) ──

function useColoresGrafico() {
  const { theme } = useTheme();
  const oscuro = theme === "dark";
  return {
    serie: oscuro ? "#3987e5" : "#2a78d6",
    grilla: oscuro ? "#2c2c2a" : "#e1e0d9",
    eje: "#898781",
    cursor: oscuro ? "rgba(255,255,255,0.06)" : "rgba(11,11,11,0.05)",
  };
}

const tooltipStyle = {
  contentStyle: { backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 },
  labelStyle: { color: "#f9fafb", fontWeight: 600 },
  itemStyle: { color: "#f3f4f6" },
};

// ── Piezas de la página ───────────────────────────────────────────

function Seccion({ titulo, criterio, icono, children }: { titulo: string; criterio: string; icono: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
        <h2 className="text-xl text-gray-900 dark:text-white flex items-center gap-2">{icono}{titulo}</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">{criterio}</span>
      </div>
      {children}
    </section>
  );
}

type Variacion = { texto: string; sube: boolean | null } | null;

function variacion(actual: number, previo: number): Variacion {
  if (previo === 0) return actual > 0 ? { texto: "nuevo", sube: true } : null;
  const pct = ((actual - previo) / previo) * 100;
  if (Math.abs(pct) < 0.05) return { texto: "0%", sube: null };
  return { texto: `${pct > 0 ? "+" : ""}${pct.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`, sube: pct > 0 };
}

function Tile({ label, valor, detalle, delta, comparacion, subirEsBueno = true }: {
  label: string; valor: string; detalle?: string; delta?: Variacion; comparacion?: string; subirEsBueno?: boolean;
}) {
  return <StatCard label={label} value={valor} detail={detalle} delta={delta} comparacion={comparacion} subirEsBueno={subirEsBueno} />;
}

type Columna = { titulo: string; valor: (fila: any) => string; derecha?: boolean };

// Tarjeta de gráfico con su versión en tabla (la información nunca depende solo del gráfico)
function ChartCard({ titulo, descripcion, filas, columnas, vacio, children, className = "" }: {
  titulo: string; descripcion?: string; filas: any[]; columnas: Columna[]; vacio: string; children: ReactNode; className?: string;
}) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-gray-900 dark:text-white">{titulo}</h3>
          {descripcion && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{descripcion}</p>}
        </div>
        {filas.length > 0 && (
          <button
            type="button"
            onClick={() => setVerTabla((v) => !v)}
            className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-pressed={verTabla}
          >
            {verTabla ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {verTabla ? "Gráfico" : "Tabla"}
          </button>
        )}
      </div>
      {filas.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center">{vacio}</p>
      ) : verTabla ? (
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                {columnas.map((c) => <th key={c.titulo} className={`py-2 px-2 font-normal ${c.derecha ? "text-right" : ""}`}>{c.titulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/60">
                  {columnas.map((c) => (
                    <td key={c.titulo} className={`py-1.5 px-2 text-gray-800 dark:text-gray-200 ${c.derecha ? "text-right tabular-nums" : ""}`}>{c.valor(f)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// Barras verticales de una sola serie (por día, día de la semana, hora)
function BarrasVerticales({ data, formato, nombre }: { data: { etiqueta: string; valor: number }[]; formato: (n: number) => string; nombre: string }) {
  const c = useColoresGrafico();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grilla} />
        <XAxis dataKey="etiqueta" tick={{ fill: c.eje, fontSize: 11 }} axisLine={{ stroke: c.grilla }} tickLine={false} interval="preserveStartEnd" minTickGap={4} />
        <YAxis tick={{ fill: c.eje, fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (formato === soles ? solesEje(v) : entero(v))} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: c.cursor }} formatter={(v: number) => [formato(v), nombre]} />
        <Bar dataKey="valor" fill={c.serie} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Barras horizontales para comparar categorías (medios de pago, distritos, servicios)
function BarrasHorizontales({ data, formato, nombre }: { data: { etiqueta: string; valor: number }[]; formato: (n: number) => string; nombre: string }) {
  const c = useColoresGrafico();
  const alto = Math.max(120, data.length * 34 + 24);
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={c.grilla} />
        <XAxis type="number" tick={{ fill: c.eje, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (formato === soles ? solesEje(v) : entero(v))} allowDecimals={false} />
        <YAxis type="category" dataKey="etiqueta" width={130} tick={{ fill: c.eje, fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: c.cursor }} formatter={(v: number) => [formato(v), nombre]} />
        <Bar dataKey="valor" fill={c.serie} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Página ────────────────────────────────────────────────────────

export function ReportsPage() {
  const { brand } = useBrand();
  const {
    paquetes: catalogoPaquetes, allProducts: catalogoProductos, carritos: catalogoCarritos,
    inflables: catalogoInflables, recursos: catalogoRecursos,
  } = useProducts();

  const hoy = getLocalDateString();
  const [modo, setModo] = useState<Modo>("month");
  const [mesSel, setMesSel] = useState(hoy.slice(0, 7));
  const [diaSel, setDiaSel] = useState(hoy);
  const [desdeSel, setDesdeSel] = useState(hoy);
  const [hastaSel, setHastaSel] = useState(hoy);

  // Datos: todas las fichas con detalle, clientes y asignaciones (desde la caché compartida)
  const [fichas, setFichas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [sinAsignaciones, setSinAsignaciones] = useState(false);

  useEffect(() => {
    if (!brand) return;
    let cancelled = false;
    setCargando(true);
    setErrorCarga("");
    setSinAsignaciones(false);
    Promise.all([
      obtenerFichasConDetalle(brand),
      obtenerClientes(brand),
      // Sin asignaciones el informe igual se muestra; solo falta saber quién lleva cada ficha
      obtenerAsignaciones().catch(() => {
        if (!cancelled) setSinAsignaciones(true);
        return [];
      }),
    ])
      .then(([f, c, a]) => {
        if (cancelled) return;
        setFichas(f);
        setClientes(c);
        setAsignaciones(a);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("No se pudo cargar reportes:", err);
        setErrorCarga("No se pudieron cargar los datos del informe. Revisa tu conexión e inténtalo de nuevo.");
      })
      .finally(() => { if (!cancelled) setCargando(false); });
    return () => { cancelled = true; };
  }, [brand]);

  const periodo = useMemo(
    () => calcularPeriodo(modo, mesSel, diaSel, desdeSel, hastaSel),
    [modo, mesSel, diaSel, desdeSel, hastaSel]
  );

  // Meses con actividad (venta, evento o pago) más el mes actual
  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>([hoy.slice(0, 7)]);
    fichas.forEach((f) => {
      [fechaVentaDe(f), fechaEventoDe(f), ...(f.abonos || []).map((a: any) => dia(a.fecha))].forEach((d) => { if (d) set.add(d.slice(0, 7)); });
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [fichas, hoy]);

  const catalogos = useMemo(() => ({
    paquetes: catalogoPaquetes, productos: catalogoProductos, carritos: catalogoCarritos, inflables: catalogoInflables, recursos: catalogoRecursos,
  }), [catalogoPaquetes, catalogoProductos, catalogoCarritos, catalogoInflables, catalogoRecursos]);

  // ── Hoy y próximos días (no depende del período) ──
  const hoyYProximos = useMemo(() => {
    const manana = sumarDias(hoy, 1);
    const finSemana = sumarDias(hoy, 6);
    const asignadas = new Set<number>(asignaciones.flatMap((a) => (Array.isArray(a.fichas_ids) ? a.fichas_ids : [])));
    const conEstado = (f: any) => ({ ...f, asignada: asignadas.has(f.id), saldoNum: Math.max(0, toMoneyNumber(f.saldo)) });
    const porHora = (a: any, b: any) => String(a.hora_entrega || "99").localeCompare(String(b.hora_entrega || "99"));
    const proximos = fichas.filter((f) => enRango(fechaEventoDe(f), hoy, finSemana)).map(conEstado);
    return {
      hoyLista: proximos.filter((f) => fechaEventoDe(f) === hoy).sort(porHora),
      mananaLista: proximos.filter((f) => fechaEventoDe(f) === manana).sort(porHora),
      sinAsignar: proximos.filter((f) => !f.asignada).length,
      saldoProximos: proximos.reduce((s, f) => s + f.saldoNum, 0),
      conSaldo: proximos.filter((f) => f.saldoNum > 0.005).length,
      totalProximos: proximos.length,
    };
  }, [fichas, asignaciones, hoy]);

  // ── Ventas (por fecha de venta) ──
  const ventas = useMemo(() => {
    const { desde, hasta, prevDesde, prevHasta } = periodo;
    const actual = fichas.filter((f) => enRango(fechaVentaDe(f), desde, hasta));
    const previo = fichas.filter((f) => enRango(fechaVentaDe(f), prevDesde, prevHasta));
    const total = (lista: any[]) => lista.reduce((s, f) => s + toMoneyNumber(f.total), 0);
    const vendido = total(actual);
    const vendidoPrev = total(previo);

    // Descuentos otorgados: los de cada ítem más el global, con la misma fórmula de la cotización
    let descuentos = 0;
    let fichasConDescuento = 0;
    actual.forEach((f) => {
      const lineas = construirLineasCotizacion(origenDesdeDetalleApi(f), catalogos);
      const monto = lineas.reduce((s, l) => s + l.descuentoMonto, 0) + toMoneyNumber(f.cotizacion) * (toMoneyNumber(f.descuento) / 100);
      if (monto > 0.005) { descuentos += monto; fichasConDescuento += 1; }
    });

    // Serie diaria; en rangos largos se agrupa por mes para que las barras sigan siendo legibles
    const porMes = diasEntre(desde, hasta) > 62;
    const serie: { etiqueta: string; valor: number; clave: string }[] = [];
    if (porMes) {
      agrupar(actual, (f) => fechaVentaDe(f).slice(0, 7), (f) => toMoneyNumber(f.total))
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
        .forEach((m) => serie.push({ clave: m.etiqueta, etiqueta: nombreMes(m.etiqueta).slice(0, 3) + " " + m.etiqueta.slice(2, 4), valor: m.valor }));
    } else {
      const porDia = new Map(agrupar(actual, fechaVentaDe, (f) => toMoneyNumber(f.total)).map((d) => [d.etiqueta, d.valor]));
      for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
        serie.push({ clave: d, etiqueta: modo === "month" ? d.slice(8, 10) : `${d.slice(8, 10)}/${d.slice(5, 7)}`, valor: porDia.get(d) || 0 });
      }
    }

    return {
      vendido, vendidoPrev,
      cantidad: actual.length, cantidadPrev: previo.length,
      ticket: actual.length ? vendido / actual.length : 0,
      ticketPrev: previo.length ? vendidoPrev / previo.length : 0,
      descuentos, fichasConDescuento,
      proporcionDescuentos: vendido + descuentos > 0 ? (descuentos / (vendido + descuentos)) * 100 : 0,
      serie, porMes,
      porTipoEvento: topConOtros(agrupar(actual, (f) => (f.tipo_evento || "Sin tipo").toString(), (f) => toMoneyNumber(f.total))),
    };
  }, [fichas, periodo, catalogos, modo]);

  // ── Cobranza (por fecha de pago) ──
  const cobranza = useMemo(() => {
    const { desde, hasta, prevDesde, prevHasta } = periodo;
    const abonos = fichas.flatMap((f) => (f.abonos || []).map((a: any) => ({ ...a, fechaDia: dia(a.fecha), montoNum: toMoneyNumber(a.monto) })));
    const actual = abonos.filter((a) => enRango(a.fechaDia, desde, hasta));
    const previo = abonos.filter((a) => enRango(a.fechaDia, prevDesde, prevHasta));
    const cobrado = actual.reduce((s, a) => s + a.montoNum, 0);
    const cobradoPrev = previo.reduce((s, a) => s + a.montoNum, 0);

    // Saldos pendientes hoy, según cuándo es (o fue) el evento
    const conSaldo = fichas
      .map((f) => ({ f, saldo: Math.max(0, toMoneyNumber(f.saldo)), evento: fechaEventoDe(f) }))
      .filter((x) => x.saldo > 0.005);
    const en7 = sumarDias(hoy, 6);
    const tramos = [
      { tramo: "Evento ya pasó", filtro: (e: string) => e < hoy },
      { tramo: "Hoy o próximos 7 días", filtro: (e: string) => e >= hoy && e <= en7 },
      { tramo: "Más adelante", filtro: (e: string) => e > en7 },
    ].map(({ tramo, filtro }) => {
      const items = conSaldo.filter((x) => filtro(x.evento));
      return { tramo, fichas: items.length, saldo: items.reduce((s, x) => s + x.saldo, 0) };
    });
    const vencidas = conSaldo
      .filter((x) => x.evento < hoy)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 8);

    return {
      cobrado, cobradoPrev, pagos: actual.length,
      porMedio: agrupar(actual, (a) => etiquetaMedio(a.medio), (a) => a.montoNum).sort((a, b) => b.valor - a.valor),
      tramos,
      saldoTotal: conSaldo.reduce((s, x) => s + x.saldo, 0),
      vencidas,
    };
  }, [fichas, periodo, hoy]);

  // ── Operación (por fecha del evento) ──
  const operacion = useMemo(() => {
    const { desde, hasta, prevDesde, prevHasta } = periodo;
    const actual = fichas.filter((f) => enRango(fechaEventoDe(f), desde, hasta));
    const previo = fichas.filter((f) => enRango(fechaEventoDe(f), prevDesde, prevHasta));

    const porDiaSemana = DIAS_SEMANA.map((etiqueta) => ({ etiqueta, valor: 0 }));
    actual.forEach((f) => {
      const d = parseLocalDate(fechaEventoDe(f));
      if (!Number.isNaN(d.getTime())) porDiaSemana[(d.getDay() + 6) % 7].valor += 1; // lunes primero
    });

    const porHora = agrupar(actual, (f) => (f.hora_entrega ? `${String(f.hora_entrega).slice(0, 2)}:00` : "Sin hora"), () => 1)
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));

    const tipoCarrito = new Map(catalogoCarritos.map((c) => [c.id, c.tipoNombre || c.modelo]));
    const paquetes = topConOtros(agrupar(actual.flatMap((f) => f.paquetes || []), (p: any) => p.paquete_nombre || "Paquete", (p: any) => Number(p.cantidad || 1)));
    const inflables = topConOtros(agrupar(actual.flatMap((f) => f.inflables || []), (i: any) => i.tipo_nombre || "Inflable", () => 1));
    const carritos = topConOtros(agrupar(actual.flatMap((f) => f.carritos || []), (c: any) => tipoCarrito.get(c.id) || c.modelo || "Carrito", () => 1));

    // Unidades de helado: contenido real de cada paquete según el catálogo, más los productos sueltos
    const unidadesPorPaquete = new Map(catalogoPaquetes.map((p) => [p.id, p.contenido.reduce((s, it) => s + Number(it.cantidad || 0), 0)]));
    const helados = actual.map((f) => {
      const enPaquetes = (f.paquetes || []).reduce((s: number, p: any) => s + (unidadesPorPaquete.get(p.paquete_id) || 0) * Number(p.cantidad || 1), 0);
      const sueltas = (f.productosSueltos || []).reduce((s: number, p: any) => s + Number(p.cantidad || 0), 0);
      return { id: f.id, cliente: f.cliente_nombre || "Cliente", fecha: fechaEventoDe(f), enPaquetes, sueltas, total: enPaquetes + sueltas };
    }).filter((h) => h.total > 0).sort((a, b) => b.total - a.total);

    return {
      eventos: actual.length, eventosPrev: previo.length,
      porDiaSemana, porHora,
      distritos: topConOtros(agrupar(actual, (f) => f.distrito || "Sin distrito", () => 1)),
      paquetes, inflables, carritos,
      helados, unidadesHelado: helados.reduce((s, h) => s + h.total, 0),
      fichasPeriodo: actual,
    };
  }, [fichas, periodo, catalogoCarritos, catalogoPaquetes]);

  // ── Clientes (altas y recurrencia en el período) ──
  const clientesPeriodo = useMemo(() => {
    const { desde, hasta, prevDesde, prevHasta } = periodo;
    const fechaAlta = (c: any) => (c.created_at ? getLocalDateString(new Date(c.created_at)) : "");
    const nuevos = clientes.filter((c) => enRango(fechaAlta(c), desde, hasta));
    const nuevosPrev = clientes.filter((c) => enRango(fechaAlta(c), prevDesde, prevHasta));

    // Recurrentes: clientes con una ficha vendida en el período que ya habían comprado antes
    const primeraCompra = new Map<string, string>();
    fichas.forEach((f) => {
      if (!f.cliente_id) return;
      const v = fechaVentaDe(f);
      const prev = primeraCompra.get(f.cliente_id);
      if (v && (!prev || v < prev)) primeraCompra.set(f.cliente_id, v);
    });
    const atendidos = new Set(fichas.filter((f) => f.cliente_id && enRango(fechaVentaDe(f), desde, hasta)).map((f) => f.cliente_id as string));
    const recurrentes = Array.from(atendidos).filter((id) => (primeraCompra.get(id) || "") < desde).length;

    return {
      nuevos: nuevos.length, nuevosPrev: nuevosPrev.length,
      atendidos: atendidos.size, recurrentes,
      canales: topConOtros(agrupar(nuevos, (c) => c.canal || "Sin canal", () => 1)),
    };
  }, [clientes, fichas, periodo]);

  // ── Cuota mensual de la marca (configurable por un admin) ──
  const esAdmin = isAdminUser();
  const mesCuota = periodo.desde.slice(0, 7);
  const [cuota, setCuota] = useState<CuotaMensual>({ monto: null, heredada: false, mes_origen: null });
  const [cuotaError, setCuotaError] = useState("");
  const [editandoCuota, setEditandoCuota] = useState(false);
  const [cuotaInput, setCuotaInput] = useState("");
  const [guardandoCuota, setGuardandoCuota] = useState(false);

  useEffect(() => {
    if (!brand || !mesCuota) return;
    let cancelled = false;
    setCuotaError("");
    apiRequest<CuotaMensual>(`/cuotas?brand=${brand}&mes=${mesCuota}`)
      .then((data) => { if (!cancelled) setCuota(data); })
      .catch((err) => {
        if (cancelled) return;
        console.error("No se pudo cargar la cuota:", err);
        setCuota({ monto: null, heredada: false, mes_origen: null });
        setCuotaError("No se pudo cargar la cuota del mes.");
      });
    return () => { cancelled = true; };
  }, [brand, mesCuota]);

  // Lo vendido en el mes de la cuota (el mes completo, aunque el período sea un día o un rango)
  const ventasMesCuota = useMemo(
    () => fichas.filter((f) => fechaVentaDe(f).slice(0, 7) === mesCuota).reduce((s, f) => s + toMoneyNumber(f.total), 0),
    [fichas, mesCuota]
  );
  const avanceCuota = cuota.monto ? (ventasMesCuota / cuota.monto) * 100 : 0;

  const guardarCuota = async () => {
    const monto = Number(cuotaInput);
    if (!Number.isFinite(monto) || monto <= 0) {
      setCuotaError("Ingresa un monto mayor a 0.");
      return;
    }
    setGuardandoCuota(true);
    setCuotaError("");
    try {
      const data = await apiRequest<CuotaMensual>("/cuotas", { method: "PUT", body: JSON.stringify({ brand, mes: mesCuota, monto }) });
      setCuota(data);
      setEditandoCuota(false);
    } catch (err) {
      setCuotaError(err instanceof Error ? err.message : "No se pudo guardar la cuota.");
    } finally {
      setGuardandoCuota(false);
    }
  };

  const etiquetaPeriodo = modo === "month"
    ? nombreMes(mesSel)
    : modo === "day"
      ? parseLocalDate(diaSel).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })
      : `${periodo.desde.split("-").reverse().join("/")} — ${periodo.hasta.split("-").reverse().join("/")}`;

  // CSV de las fichas con evento en el período
  const exportCSV = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const estado = (f: any) => {
      const saldo = toMoneyNumber(f.saldo);
      if (saldo <= 0) return "Pagado";
      return toMoneyNumber(f.total) - saldo > 0 ? "Parcial" : "Pendiente";
    };
    const headers = ["# Ficha", "Cliente", "Celular", "Fecha Evento", "Fecha Venta", "Distrito", "Dirección", "Tipo de evento", "Paquetes", "Total", "Abonado", "Saldo", "Estado", "Registrado por"];
    const rows = operacion.fichasPeriodo.map((f) => [
      f.id, f.cliente_nombre || "", f.cliente_celular || "", fechaEventoDe(f), fechaVentaDe(f), f.distrito || "", f.direccion || "",
      f.tipo_evento || "", (f.paquetes || []).map((p: any) => `${p.paquete_nombre || ""} x${p.cantidad || 1}`).join(" | "),
      toMoneyNumber(f.total).toFixed(2), toMoneyNumber(f.total_abonado).toFixed(2), Math.max(0, toMoneyNumber(f.saldo)).toFixed(2),
      estado(f), f.created_by_nombre || "",
    ].map(esc).join(","));
    const blob = new Blob(["﻿" + [headers.map(esc).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fichas_${etiquetaPeriodo.replace(/[\s/—]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = campoCompacto;
  const cmp = periodo.comparacion;

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 dark:bg-gray-900">
      {/* Encabezado y filtro de período (aplica a todas las secciones salvo "Hoy") */}
      <div className="mb-6">
        <PageHeader
          className="mb-4"
          title="Reportes"
          subtitle="Resumen del día y análisis de ventas, cobranza y operación"
          actions={
            <Button variant="brand" onClick={exportCSV} disabled={operacion.fichasPeriodo.length === 0} className="w-full sm:w-auto">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          }
        />
        {errorCarga && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errorCarga}</span>
          </div>
        )}
        {!errorCarga && sinAsignaciones && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>No se pudieron cargar las asignaciones de choferes: los eventos pueden aparecer como «Sin asignar» aunque ya tengan chofer.</span>
          </div>
        )}
      </div>

      {/* ══ HOY Y PRÓXIMOS DÍAS ══ */}
      <Seccion titulo="Hoy y próximos días" criterio="Fecha del evento · no depende del período" icono={<CalendarClock className="w-5 h-5 text-brand-orange" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Tile label="Eventos hoy" valor={entero(hoyYProximos.hoyLista.length)} />
          <Tile label="Eventos mañana" valor={entero(hoyYProximos.mananaLista.length)} />
          <Tile label="Sin chofer asignado" valor={entero(hoyYProximos.sinAsignar)} detalle={`de ${plural(hoyYProximos.totalProximos, "evento", "eventos")} en los próximos 7 días`} />
          <Tile label="Por cobrar antes del evento" valor={soles(hoyYProximos.saldoProximos)} detalle={`${plural(hoyYProximos.conSaldo, "ficha", "fichas")} con saldo en los próximos 7 días`} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[{ titulo: "Hoy", lista: hoyYProximos.hoyLista }, { titulo: "Mañana", lista: hoyYProximos.mananaLista }].map(({ titulo, lista }) => (
            <div key={titulo} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-gray-900 dark:text-white mb-3">{titulo}</h3>
              {lista.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Sin eventos</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-2 font-normal">Hora</th>
                        <th className="py-2 px-2 font-normal">Cliente</th>
                        <th className="py-2 px-2 font-normal">Distrito</th>
                        <th className="py-2 px-2 font-normal">Chofer</th>
                        <th className="py-2 pl-2 font-normal text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((f) => (
                        <tr key={f.id} className="border-b border-gray-100 dark:border-gray-700/60">
                          <td className="py-1.5 pr-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">{horaCorta(f.hora_entrega)}</td>
                          <td className="py-1.5 px-2 text-gray-800 dark:text-gray-200">{f.cliente_nombre}<span className="text-xs text-gray-400"> · #{f.id}</span></td>
                          <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300">{f.distrito || "—"}</td>
                          <td className="py-1.5 px-2">
                            {f.asignada
                              ? <span className="text-xs text-green-700 dark:text-green-400">Asignado</span>
                              : <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><Truck className="w-3.5 h-3.5" />Sin asignar</span>}
                          </td>
                          <td className={`py-1.5 pl-2 text-right tabular-nums ${f.saldoNum > 0.005 ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
                            {f.saldoNum > 0.005 ? soles(f.saldoNum) : "Pagado"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </Seccion>

      {/* Filtro de período: una sola fila para todas las secciones de análisis */}
      <div className="sticky top-[61px] lg:top-0 z-[5] -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 mb-6 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur border-y border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-400">Período:</span>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
          {(["month", "day", "range"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className={`px-4 py-2 transition-colors ${modo === m ? "bg-brand-orange text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
              {m === "month" ? "Mensual" : m === "day" ? "Diario" : "Por rango"}
            </button>
          ))}
        </div>
        {modo === "month" && (
          <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className={inputClass}>
            {mesesDisponibles.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
        )}
        {modo === "day" && <input type="date" value={diaSel} onChange={(e) => e.target.value && setDiaSel(e.target.value)} className={inputClass} />}
        {modo === "range" && (
          <div className="flex items-center gap-2">
            <input type="date" value={desdeSel} onChange={(e) => e.target.value && setDesdeSel(e.target.value)} className={inputClass} />
            <span className="text-gray-400">—</span>
            <input type="date" value={hastaSel} min={desdeSel} onChange={(e) => e.target.value && setHastaSel(e.target.value)} className={inputClass} />
          </div>
        )}
        {cargando && <Loader2 className="w-5 h-5 text-brand-orange animate-spin shrink-0" />}
        <span className="text-xs text-gray-500 dark:text-gray-400">Comparado con el {cmp}</span>
      </div>

      {/* ══ VENTAS ══ */}
      <Seccion titulo="Ventas" criterio="Según la fecha en que se vendió la ficha · total cotizado, no lo cobrado" icono={<Target className="w-5 h-5 text-brand-navy dark:text-blue-400" />}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          {/* Cuota mensual */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-gray-900 dark:text-white">Cuota de {nombreMes(mesCuota)}</h3>
                {modo !== "month" && <p className="text-xs text-gray-500 dark:text-gray-400">Mes completo del período elegido</p>}
              </div>
              {esAdmin && !editandoCuota && (
                <button
                  onClick={() => { setCuotaInput(cuota.monto ? String(cuota.monto) : ""); setCuotaError(""); setEditandoCuota(true); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5" /> {cuota.monto && !cuota.heredada ? "Editar cuota" : "Asignar cuota"}
                </button>
              )}
            </div>
            {editandoCuota && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">Cuota de {nombreMes(mesCuota)}: S/</span>
                <input type="number" min={1} step="0.01" autoFocus value={cuotaInput}
                  onChange={(e) => setCuotaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") guardarCuota(); if (e.key === "Escape") setEditandoCuota(false); }}
                  className="w-36 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                <button onClick={guardarCuota} disabled={guardandoCuota} className="text-sm px-3 py-1.5 rounded-lg bg-brand-orange text-white hover:bg-brand-orange-hover disabled:opacity-60">
                  {guardandoCuota ? "Guardando..." : "Guardar"}
                </button>
                <button onClick={() => setEditandoCuota(false)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">Cancelar</button>
              </div>
            )}
            {cuotaError && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{cuotaError}</p>}
            {cuota.monto ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <CuotaGauge porcentaje={avanceCuota} />
                <div className="flex-1 w-full space-y-1.5">
                  <p className="text-4xl font-semibold" style={{ color: colorDeAvance(avanceCuota) }}>{avanceCuota.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Vendido <span className="text-gray-900 dark:text-white">{soles(ventasMesCuota)}</span> de {soles(cuota.monto)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {ventasMesCuota >= cuota.monto ? `Cuota superada por ${soles(ventasMesCuota - cuota.monto)}` : `Faltan ${soles(cuota.monto - ventasMesCuota)}`}
                  </p>
                  {cuota.heredada && cuota.mes_origen && <p className="text-xs text-gray-400 dark:text-gray-500">Usa la cuota de {nombreMes(cuota.mes_origen)}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
                {esAdmin ? "Aún no hay cuota asignada para este mes." : "Aún no hay cuota asignada para este mes. Pídele a un administrador que la configure."}
                {" "}Vendido en el mes: {soles(ventasMesCuota)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 lg:col-span-2 gap-4">
            <Tile label="Vendido" valor={soles(ventas.vendido)} delta={variacion(ventas.vendido, ventas.vendidoPrev)} comparacion={cmp} />
            <Tile label="Fichas vendidas" valor={entero(ventas.cantidad)} delta={variacion(ventas.cantidad, ventas.cantidadPrev)} comparacion={cmp} />
            <Tile label="Ticket promedio" valor={soles(ventas.ticket)} delta={variacion(ventas.ticket, ventas.ticketPrev)} comparacion={cmp} />
            <Tile label="Descuentos otorgados" valor={soles(ventas.descuentos)}
              detalle={`${plural(ventas.fichasConDescuento, "ficha", "fichas")} · ${ventas.proporcionDescuentos.toLocaleString("es-PE", { maximumFractionDigits: 1 })}% del valor de lista`} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard className="lg:col-span-2" titulo={ventas.porMes ? "Ventas por mes" : "Ventas por día"} descripcion={etiquetaPeriodo}
            filas={ventas.serie.filter((s) => s.valor > 0)} vacio="No hubo ventas en el período"
            columnas={[{ titulo: ventas.porMes ? "Mes" : "Día", valor: (f) => (ventas.porMes ? nombreMes(f.clave) : f.clave.split("-").reverse().join("/")) }, { titulo: "Vendido", valor: (f) => soles(f.valor), derecha: true }]}>
            <BarrasVerticales data={ventas.serie} formato={soles} nombre="Vendido" />
          </ChartCard>
          <ChartCard titulo="Por tipo de evento" filas={ventas.porTipoEvento} vacio="Sin ventas en el período"
            columnas={[{ titulo: "Tipo", valor: (f) => f.etiqueta }, { titulo: "Vendido", valor: (f) => soles(f.valor), derecha: true }]}>
            <BarrasHorizontales data={ventas.porTipoEvento} formato={soles} nombre="Vendido" />
          </ChartCard>
        </div>
      </Seccion>

      {/* ══ COBRANZA ══ */}
      <Seccion titulo="Cobranza" criterio="Según la fecha de cada pago · el saldo pendiente es a hoy" icono={<Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Tile label="Cobrado" valor={soles(cobranza.cobrado)} delta={variacion(cobranza.cobrado, cobranza.cobradoPrev)} comparacion={cmp} detalle={`${plural(cobranza.pagos, "pago", "pagos")} en el período`} />
          <Tile label="Saldo por cobrar (hoy)" valor={soles(cobranza.saldoTotal)} detalle="Todas las fichas con saldo" />
          <Tile label="De eventos que ya pasaron" valor={soles(cobranza.tramos[0].saldo)} detalle={plural(cobranza.tramos[0].fichas, "ficha", "fichas")} />
          <Tile label="De eventos en 7 días" valor={soles(cobranza.tramos[1].saldo)} detalle={plural(cobranza.tramos[1].fichas, "ficha", "fichas")} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard titulo="Cobrado por medio de pago" descripcion={etiquetaPeriodo} filas={cobranza.porMedio} vacio="No hubo pagos en el período"
            columnas={[{ titulo: "Medio", valor: (f) => f.etiqueta }, { titulo: "Cobrado", valor: (f) => soles(f.valor), derecha: true }]}>
            <BarrasHorizontales data={cobranza.porMedio} formato={soles} nombre="Cobrado" />
          </ChartCard>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-900 dark:text-white">Saldos de eventos que ya pasaron</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">Los más altos primero</p>
            {cobranza.vencidas.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center">No hay saldos de eventos pasados</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-2 font-normal">Ficha</th>
                    <th className="py-2 px-2 font-normal">Evento</th>
                    <th className="py-2 pl-2 font-normal text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {cobranza.vencidas.map(({ f, saldo, evento }) => (
                    <tr key={f.id} className="border-b border-gray-100 dark:border-gray-700/60">
                      <td className="py-1.5 pr-2 text-gray-800 dark:text-gray-200">{f.cliente_nombre}<span className="text-xs text-gray-400"> · #{f.id}</span></td>
                      <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{evento.split("-").reverse().join("/")}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900 dark:text-white">{soles(saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </Seccion>

      {/* ══ OPERACIÓN ══ */}
      <Seccion titulo="Operación" criterio="Según la fecha del evento" icono={<Truck className="w-5 h-5 text-purple-600 dark:text-purple-400" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Tile label="Eventos" valor={entero(operacion.eventos)} delta={variacion(operacion.eventos, operacion.eventosPrev)} comparacion={cmp} />
          {brand === "donofrio" && (
            <Tile label="Unidades de helado" valor={entero(operacion.unidadesHelado)} detalle={`${plural(operacion.helados.length, "ficha", "fichas")} con helados`} />
          )}
          <Tile label="Día con más eventos" valor={operacion.eventos ? [...operacion.porDiaSemana].sort((a, b) => b.valor - a.valor)[0].etiqueta : "—"} />
          <Tile label="Distrito principal" valor={operacion.distritos[0]?.etiqueta ?? "—"} detalle={operacion.distritos[0] ? plural(operacion.distritos[0].valor, "evento", "eventos") : undefined} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <ChartCard titulo="Eventos por día de la semana" filas={operacion.eventos ? operacion.porDiaSemana : []} vacio="Sin eventos en el período"
            columnas={[{ titulo: "Día", valor: (f) => f.etiqueta }, { titulo: "Eventos", valor: (f) => entero(f.valor), derecha: true }]}>
            <BarrasVerticales data={operacion.porDiaSemana} formato={entero} nombre="Eventos" />
          </ChartCard>
          <ChartCard titulo="Eventos por hora de entrega" filas={operacion.porHora} vacio="Sin eventos en el período"
            columnas={[{ titulo: "Hora", valor: (f) => f.etiqueta }, { titulo: "Eventos", valor: (f) => entero(f.valor), derecha: true }]}>
            <BarrasVerticales data={operacion.porHora} formato={entero} nombre="Eventos" />
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <ChartCard titulo="Distritos" filas={operacion.distritos} vacio="Sin eventos en el período"
            columnas={[{ titulo: "Distrito", valor: (f) => f.etiqueta }, { titulo: "Eventos", valor: (f) => entero(f.valor), derecha: true }]}>
            <BarrasHorizontales data={operacion.distritos} formato={entero} nombre="Eventos" />
          </ChartCard>
          <ChartCard titulo="Paquetes más pedidos" filas={operacion.paquetes} vacio="Sin paquetes en el período"
            columnas={[{ titulo: "Paquete", valor: (f) => f.etiqueta }, { titulo: "Cantidad", valor: (f) => entero(f.valor), derecha: true }]}>
            <BarrasHorizontales data={operacion.paquetes} formato={entero} nombre="Cantidad" />
          </ChartCard>
          {/* Las tarjetas de inflables y carritos solo aparecen si hubo alguno en el período */}
          {operacion.inflables.length > 0 && (
            <ChartCard titulo="Inflables más pedidos" filas={operacion.inflables} vacio="Sin inflables en el período"
              columnas={[{ titulo: "Inflable", valor: (f) => f.etiqueta }, { titulo: "Eventos", valor: (f) => entero(f.valor), derecha: true }]}>
              <BarrasHorizontales data={operacion.inflables} formato={entero} nombre="Eventos" />
            </ChartCard>
          )}
          {operacion.carritos.length > 0 && (
            <ChartCard titulo="Carritos más pedidos" filas={operacion.carritos} vacio="Sin carritos en el período"
              columnas={[{ titulo: "Carrito", valor: (f) => f.etiqueta }, { titulo: "Eventos", valor: (f) => entero(f.valor), derecha: true }]}>
              <BarrasHorizontales data={operacion.carritos} formato={entero} nombre="Eventos" />
            </ChartCard>
          )}
        </div>
        {brand === "donofrio" && (
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-900 dark:text-white">Helados por ficha</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">Contenido de cada paquete según el catálogo, más los productos sueltos</p>
            {operacion.helados.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Sin helados en el período</p>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-2 font-normal">Ficha</th>
                      <th className="py-2 px-2 font-normal">Evento</th>
                      <th className="py-2 px-2 font-normal text-right">En paquetes</th>
                      <th className="py-2 px-2 font-normal text-right">Sueltos</th>
                      <th className="py-2 pl-2 font-normal text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operacion.helados.map((h) => (
                      <tr key={h.id} className="border-b border-gray-100 dark:border-gray-700/60">
                        <td className="py-1.5 pr-2 text-gray-800 dark:text-gray-200">{h.cliente}<span className="text-xs text-gray-400"> · #{h.id}</span></td>
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{h.fecha.split("-").reverse().join("/")}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{entero(h.enPaquetes)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{entero(h.sueltas)}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900 dark:text-white">{entero(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Seccion>

      {/* ══ CLIENTES ══ */}
      <Seccion titulo="Clientes" criterio="Altas y compras en el período" icono={<Users className="w-5 h-5 text-brand-orange" />}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <Tile label="Clientes nuevos" valor={entero(clientesPeriodo.nuevos)} delta={variacion(clientesPeriodo.nuevos, clientesPeriodo.nuevosPrev)} comparacion={cmp} />
            <Tile label="Clientes que compraron" valor={entero(clientesPeriodo.atendidos)}
              detalle={clientesPeriodo.recurrentes === 1 ? "1 ya había comprado antes" : `${entero(clientesPeriodo.recurrentes)} ya habían comprado antes`} />
          </div>
          <ChartCard className="lg:col-span-2" titulo="Canal de los clientes nuevos" filas={clientesPeriodo.canales} vacio="No se registraron clientes nuevos en el período"
            columnas={[{ titulo: "Canal", valor: (f) => f.etiqueta }, { titulo: "Clientes", valor: (f) => entero(f.valor), derecha: true }]}>
            <BarrasHorizontales data={clientesPeriodo.canales} formato={entero} nombre="Clientes" />
          </ChartCard>
        </div>
      </Seccion>
    </div>
  );
}
