import { useEffect, useMemo, useState } from "react";
import { Calendar, CreditCard, DollarSign, Receipt, Search, X, Eye, ExternalLink, Loader2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useBrand } from "../contexts/BrandContext";

interface PagoRow {
  id: number;
  fichaId: number;
  clienteNombre: string;
  fechaPago: string;
  monto: number;
  medio: string;
  numeroOperacion: string;
  comprobanteUrl: string;
}

const MEDIOS = ["Todos", "Transferencia", "Yape", "Plin", "Efectivo"];

const MEDIO_COLORS: Record<string, string> = {
  Transferencia: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Yape:          "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Plin:          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Efectivo:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function formatMoney(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PagosPage() {
  const { brand } = useBrand();
  const today        = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [allFichas,   setAllFichas]   = useState<any[]>([]);
  const [pagos,       setPagos]       = useState<PagoRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [filterFrom,  setFilterFrom]  = useState(firstOfMonth);
  const [filterTo,    setFilterTo]    = useState(today);
  const [filterMedio, setFilterMedio] = useState("Todos");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);

  // 1. Carga liviana de fichas
  useEffect(() => {
    if (!brand) return;
    apiRequest<any[]>(`/fichas?brand=${brand}`)
      .then(setAllFichas)
      .catch(console.error);
  }, [brand]);

  // 2. Carga detalles solo de las fichas dentro del rango, luego extrae abonos
  useEffect(() => {
    if (!allFichas.length) { setPagos([]); return; }

    const enRango = allFichas.filter((f) => {
      const d = (f.fecha || "").slice(0, 10);
      return (!filterFrom || d >= filterFrom) && (!filterTo || d <= filterTo);
    });

    if (!enRango.length) { setPagos([]); return; }

    let cancelled = false;
    setLoading(true);

    Promise.all(enRango.map((f) => apiRequest<any>(`/fichas/${f.id}`)))
      .then((detalles) => {
        if (cancelled) return;
        const rows: PagoRow[] = [];
        detalles.forEach((ficha) => {
          (ficha.abonos || []).forEach((a: any) => {
            rows.push({
              id: a.id,
              fichaId: ficha.id,
              clienteNombre: ficha.cliente_nombre || "",
              fechaPago: a.fecha || "",
              monto: Number(a.monto || 0),
              medio: a.medio || "",
              numeroOperacion: a.numero_operacion || "",
              comprobanteUrl: a.comprobante_url || "",
            });
          });
        });
        rows.sort((a, b) => b.fechaPago.localeCompare(a.fechaPago));
        setPagos(rows);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [allFichas, filterFrom, filterTo]);

  const filteredPagos = useMemo(() => pagos.filter((p) => {
    const matchesMedio  = filterMedio === "Todos" || p.medio === filterMedio;
    const q             = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      p.clienteNombre.toLowerCase().includes(q) ||
      String(p.fichaId).includes(q) ||
      p.numeroOperacion.toLowerCase().includes(q);
    return matchesMedio && matchesSearch;
  }), [pagos, filterMedio, searchTerm]);

  const stats = useMemo(() => ({
    total:    filteredPagos.reduce((s, p) => s + p.monto, 0),
    porMedio: MEDIOS.slice(1).map((medio) => ({
      medio,
      monto: filteredPagos.filter((p) => p.medio === medio).reduce((s, p) => s + p.monto, 0),
      count: filteredPagos.filter((p) => p.medio === medio).length,
    })),
  }), [filteredPagos]);

  const inputClass = "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8022]";

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Registro de Pagos</h1>
        <p className="text-gray-600 dark:text-gray-400">Comprobantes y abonos registrados por período</p>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente, ficha, N° operación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={inputClass} />
            <span className="text-gray-400">—</span>
            <input type="date" value={filterTo} min={filterFrom} onChange={(e) => setFilterTo(e.target.value)} className={inputClass} />
          </div>
          <select value={filterMedio} onChange={(e) => setFilterMedio(e.target.value)} className={inputClass}>
            {MEDIOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {loading && <Loader2 className="w-5 h-5 text-[#EF8022] animate-spin shrink-0" />}
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="md:col-span-1 bg-[#1F3C8B] text-white rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 opacity-80" />
            <span className="text-xs opacity-80 uppercase tracking-wide">Total cobrado</span>
          </div>
          <p className="text-xl">{formatMoney(stats.total)}</p>
          <p className="text-xs opacity-60 mt-1">{filteredPagos.length} pago{filteredPagos.length !== 1 ? "s" : ""}</p>
        </div>
        {stats.porMedio.map(({ medio, monto, count }) => (
          <div key={medio} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{medio}</span>
            </div>
            <p className="text-base text-gray-900 dark:text-white">{formatMoney(monto)}</p>
            <p className="text-xs text-gray-400 mt-1">{count} pago{count !== 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#EF8022] animate-spin" />
            Cargando pagos...
          </div>
        ) : filteredPagos.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No hay pagos en el período seleccionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fecha Pago</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ficha / Cliente</th>
                  <th className="text-right py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monto</th>
                  <th className="text-center py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Medio</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">N° Operación</th>
                  <th className="text-center py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredPagos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.fechaPago}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-400 mr-2 font-mono">#{p.fichaId}</span>
                      <span className="text-gray-900 dark:text-white">{p.clienteNombre}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 dark:text-white">{formatMoney(p.monto)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${MEDIO_COLORS[p.medio] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}>
                        {p.medio || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 font-mono text-xs">{p.numeroOperacion || "—"}</td>
                    <td className="py-3 px-4 text-center">
                      {p.comprobanteUrl ? (
                        <button
                          onClick={() => setPreviewUrl(p.comprobanteUrl)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1F3C8B]/10 text-[#1F3C8B] dark:bg-[#1F3C8B]/20 dark:text-blue-400 hover:bg-[#1F3C8B]/20 transition-colors text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">Sin comprobante</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={2} className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">{filteredPagos.length} registros</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900 dark:text-white">{formatMoney(stats.total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal de vista previa de comprobante */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-700 dark:text-gray-300">Comprobante de pago</span>
              <div className="flex items-center gap-1">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                  title="Abrir en nueva pestaña"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={previewUrl}
              alt="Comprobante"
              className="w-full max-h-[70vh] object-contain bg-gray-50 dark:bg-gray-900"
            />
          </div>
        </div>
      )}
    </div>
  );
}
