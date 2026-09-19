import { useEffect, useMemo, useState } from "react";
import { Calendar, CreditCard, DollarSign, Receipt, Search, X, Eye, ExternalLink, Loader2, Edit, Upload, Trash2 } from "lucide-react";
import { apiRequest, API_BASE_URL } from "../lib/api";
import { useBrand } from "../contexts/BrandContext";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";

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

const MEDIOS = ["Todos", "Transferencia", "Yape", "Plin", "Efectivo", "Link de Pago"];

const MEDIO_COLORS: Record<string, string> = {
  Transferencia: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Yape:          "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Plin:          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Efectivo:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Link de Pago": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

function formatMoney(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFechaPago(fechaIso: string) {
  if (!fechaIso) return "-";
  const raw = fechaIso.includes("T") ? fechaIso.slice(0, 10) : fechaIso;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fechaIso;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function extractStoragePathFromUrl(value: string) {
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.origin);
    const match = parsed.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch { /* no parseable */ }
  return "";
}

export function PagosPage() {
  const { brand } = useBrand();
  const [allFichas,   setAllFichas]   = useState<any[]>([]);
  const [pagos,       setPagos]       = useState<PagoRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [filterFrom,  setFilterFrom]  = useState("");
  const [filterTo,    setFilterTo]    = useState("");
  const [filterMedio, setFilterMedio] = useState("Todos");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [editingPago, setEditingPago] = useState<PagoRow | null>(null);
  const [deletingPago, setDeletingPago] = useState<PagoRow | null>(null);
  const [isDeletingPago, setIsDeletingPago] = useState(false);

  // 1. Carga liviana de fichas
  useEffect(() => {
    if (!brand) return;
    apiRequest<any[]>(`/fichas?brand=${brand}`)
      .then(setAllFichas)
      .catch(console.error);
  }, [brand]);

  // 2. Carga los abonos de todas las fichas de la marca; el filtro por fecha se aplica
  //    sobre la fecha del PAGO, no sobre la fecha del evento.
  useEffect(() => {
    if (!allFichas.length) { setPagos([]); return; }

    let cancelled = false;
    setLoading(true);

    Promise.all(allFichas.map((f) => apiRequest<any>(`/fichas/${f.id}`)))
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
  }, [allFichas]);

  const handleSavePago = async (updated: PagoRow) => {
    await apiRequest(`/fichas/${updated.fichaId}/abonos/${updated.id}`, {
      method: "PUT",
      body: JSON.stringify({
        fecha: updated.fechaPago,
        monto: updated.monto,
        numero_operacion: updated.numeroOperacion || null,
        comprobante_url: updated.comprobanteUrl || null,
        medio: updated.medio,
      }),
    });
    setPagos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDeletePago = async () => {
    if (!deletingPago) return;
    setIsDeletingPago(true);
    try {
      await apiRequest(`/fichas/${deletingPago.fichaId}/abonos/${deletingPago.id}`, { method: "DELETE" });

      if (deletingPago.comprobanteUrl) {
        const path = extractStoragePathFromUrl(deletingPago.comprobanteUrl);
        if (path) {
          try {
            await apiRequest("/upload", { method: "DELETE", body: JSON.stringify({ path }) });
          } catch {
            // best-effort cleanup: an orphaned file in storage is not worth blocking the user over
          }
        }
      }

      setPagos((prev) => prev.filter((p) => p.id !== deletingPago.id));
      setDeletingPago(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingPago(false);
    }
  };

  const filteredPagos = useMemo(() => pagos.filter((p) => {
    const fechaPago     = (p.fechaPago || "").slice(0, 10);
    const matchesFecha  = (!filterFrom || fechaPago >= filterFrom) && (!filterTo || fechaPago <= filterTo);
    const matchesMedio  = filterMedio === "Todos" || p.medio === filterMedio;
    const q             = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      p.clienteNombre.toLowerCase().includes(q) ||
      String(p.fichaId).includes(q) ||
      p.numeroOperacion.toLowerCase().includes(q);
    return matchesFecha && matchesMedio && matchesSearch;
  }), [pagos, filterFrom, filterTo, filterMedio, searchTerm]);

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
                  <th className="text-center py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredPagos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatFechaPago(p.fechaPago)}</td>
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
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingPago(p)}
                          className="p-1.5 text-gray-400 hover:text-[#EF8022] hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                          title="Editar pago"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingPago(p)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Eliminar pago"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={2} className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">{filteredPagos.length} registros</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-900 dark:text-white">{formatMoney(stats.total)}</td>
                  <td colSpan={4} />
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

      {/* Modal de edición de pago */}
      {editingPago && (
        <EditPagoModal
          pago={editingPago}
          onClose={() => setEditingPago(null)}
          onSave={handleSavePago}
        />
      )}

      <DeleteConfirmDialog
        open={deletingPago !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPago(null);
        }}
        title="Eliminar pago"
        description={
          deletingPago
            ? `¿Seguro que quieres eliminar el pago de ${formatMoney(deletingPago.monto)} de la ficha #${deletingPago.fichaId}? El comprobante asociado también se eliminará. Esta acción no se puede deshacer.`
            : "¿Seguro que quieres eliminar este pago?"
        }
        confirmLabel="Eliminar pago"
        loadingLabel="Eliminando..."
        loading={isDeletingPago}
        onConfirm={handleDeletePago}
      />
    </div>
  );
}

function EditPagoModal({
  pago,
  onClose,
  onSave,
}: {
  pago: PagoRow;
  onClose: () => void;
  onSave: (updated: PagoRow) => Promise<void>;
}) {
  const [fecha, setFecha] = useState(pago.fechaPago.includes("T") ? pago.fechaPago.slice(0, 10) : pago.fechaPago);
  const [monto, setMonto] = useState<string>(String(pago.monto));
  const [medio, setMedio] = useState(pago.medio || "Transferencia");
  const [numeroOperacion, setNumeroOperacion] = useState(pago.numeroOperacion || "");
  const originalComprobanteUrl = pago.comprobanteUrl || "";
  const [comprobanteUrl, setComprobanteUrl] = useState(originalComprobanteUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setModalError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "comprobantes");

      const response = await fetch(`${API_BASE_URL}/upload`, { method: "POST", body: formData });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");
        const errorData = isJson ? await response.json() : { error: `HTTP ${response.status}` };
        throw new Error((errorData as any).error || "Error al subir el archivo");
      }

      const data = await response.json();
      const rawUrl = data?.url || data?.fileUrl || data?.secure_url || data?.location || data?.data?.url || "";
      const rawPath = data?.path || data?.filePath || data?.data?.path || extractStoragePathFromUrl(rawUrl);
      if (!rawUrl || !rawPath) throw new Error("La API respondió sin URL/path del archivo subido");

      const normalizedUrl = typeof rawUrl === "string" && rawUrl.startsWith("/")
        ? `${new URL(API_BASE_URL, window.location.origin).origin}${rawUrl}`
        : rawUrl;
      setComprobanteUrl(normalizedUrl);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error al subir el comprobante");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    if (isUploading) return;
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const renamedFile = new File([file], file.name || `comprobante-pegado-${Date.now()}.png`, { type: file.type });
    await uploadFile(renamedFile);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const montoNumerico = Number(monto);
    if (!montoNumerico || montoNumerico <= 0) return;

    setModalError("");
    setIsSaving(true);
    try {
      await onSave({
        ...pago,
        fechaPago: fecha,
        monto: montoNumerico,
        medio,
        numeroOperacion: numeroOperacion.trim(),
        comprobanteUrl,
      });

      if (originalComprobanteUrl && originalComprobanteUrl !== comprobanteUrl) {
        const path = extractStoragePathFromUrl(originalComprobanteUrl);
        if (path) {
          try {
            await apiRequest("/upload", { method: "DELETE", body: JSON.stringify({ path }) });
          } catch {
            // best-effort cleanup: an orphaned file in storage is not worth blocking the user over
          }
        }
      }

      onClose();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error al guardar el pago");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-2xl text-gray-900 dark:text-white">Editar Pago</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ficha #{pago.fichaId} · {pago.clienteNombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {modalError && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-700 dark:text-red-400">{modalError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Monto</label>
            <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Medio de pago</label>
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputClass}>
              <option value="Transferencia">Transferencia</option>
              <option value="Yape">Yape</option>
              <option value="Plin">Plin</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Link de Pago">Link de Pago</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Número de operación</label>
            <input type="text" value={numeroOperacion} onChange={(e) => setNumeroOperacion(e.target.value)} placeholder="Opcional" className={inputClass} />
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Comprobante</label>
            <div
              tabIndex={0}
              onPaste={(e) => void handlePaste(e)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#EF8022] ${
                isUploading ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400" : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
              }`}
            >
              <label className={`flex cursor-pointer items-center justify-center gap-2 text-sm ${isUploading ? "cursor-not-allowed" : "hover:text-[#EF8022]"}`}>
                <Upload className="w-4 h-4" />
                <span>{isUploading ? "Subiendo..." : "Subir imagen del comprobante"}</span>
                <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} className="hidden" />
              </label>
              <span className="text-xs text-gray-400 dark:text-gray-500">o haz clic aquí y pega una imagen (Ctrl+V)</span>
            </div>
            {comprobanteUrl && (
              <div className="mt-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <img src={comprobanteUrl} alt="Vista previa del comprobante" className="max-h-48 w-full object-contain bg-black/5" />
                </div>
                <button
                  type="button"
                  onClick={() => setComprobanteUrl("")}
                  disabled={isUploading}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Quitar imagen
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="flex-1 bg-[#EF8022] text-white py-3 rounded-lg hover:bg-[#d9711c] disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
