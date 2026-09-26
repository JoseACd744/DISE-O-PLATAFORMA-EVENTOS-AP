import { useEffect, useMemo, useState } from "react";
import { Calendar, CreditCard, DollarSign, Receipt, Search, X, Eye, ExternalLink, Loader2, Edit, Upload, Trash2 } from "lucide-react";
import { apiRequest, API_BASE_URL, apiUpload } from "../lib/api";
import { invalidarFichas, obtenerFichasConDetalle } from "../lib/queries";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import { StatCard } from "../components/ui/stat-card";
import { PageHeader } from "../components/ui/page-header";
import { ErrorBanner } from "../components/ui/feedback";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { mensajeDeError, notify } from "../lib/notify";
import { useBrand } from "../contexts/BrandContext";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { campo, campoCompacto, etiqueta } from "../lib/ui";

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
  const [pagos,       setPagos]       = useState<PagoRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterFrom,  setFilterFrom]  = useState("");
  const [filterTo,    setFilterTo]    = useState("");
  const [filterMedio, setFilterMedio] = useState("Todos");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [editingPago, setEditingPago] = useState<PagoRow | null>(null);
  const [deletingPago, setDeletingPago] = useState<PagoRow | null>(null);
  const [isDeletingPago, setIsDeletingPago] = useState(false);
  const [cargaError, setCargaError] = useState("");
  const [deletePagoError, setDeletePagoError] = useState("");

  // Todas las fichas de la marca con sus abonos en una sola petición (antes: una por ficha).
  // El filtro por fecha se aplica sobre la fecha del PAGO, no sobre la del evento.
  useEffect(() => {
    if (!brand) return;
    let cancelled = false;
    setLoading(true);
    setCargaError("");
    obtenerFichasConDetalle(brand)
      .then((fichas) => {
        if (cancelled) return;
        const rows: PagoRow[] = [];
        fichas.forEach((ficha) => {
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
      .catch((err) => {
        if (cancelled) return;
        console.error("No se pudieron cargar los pagos:", err);
        setPagos([]);
        setCargaError("No se pudieron cargar los pagos. Revisa tu conexión e inténtalo de nuevo.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brand]);

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
    // Fichas y Reportes deben ver el cambio la próxima vez que se abran
    void invalidarFichas();
    notify.ok("Pago actualizado");
  };

  const handleDeletePago = async () => {
    if (!deletingPago) return;
    setIsDeletingPago(true);
    setDeletePagoError("");
    try {
      await apiRequest(`/fichas/${deletingPago.fichaId}/abonos/${deletingPago.id}`, { method: "DELETE" });

      if (deletingPago.comprobanteUrl) {
        const path = extractStoragePathFromUrl(deletingPago.comprobanteUrl);
        if (path) {
          try {
            await apiRequest("/upload", { method: "DELETE", body: JSON.stringify({ path }), silencioso: true });
          } catch {
            // best-effort cleanup: an orphaned file in storage is not worth blocking the user over
          }
        }
      }

      notify.ok(`Pago de ${formatMoney(deletingPago.monto)} eliminado`);
      setPagos((prev) => prev.filter((p) => p.id !== deletingPago.id));
      void invalidarFichas();
      setDeletingPago(null);
    } catch (err) {
      setDeletePagoError(mensajeDeError(err, "No se pudo eliminar el pago."));
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

  const inputClass = campoCompacto;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <PageHeader title="Registro de Pagos" subtitle="Comprobantes y abonos registrados por período" />

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-0 basis-full sm:basis-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente, ficha, N° operación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={`${inputClass} min-w-0 flex-1 sm:flex-none`} aria-label="Desde" />
            <span className="text-gray-400">—</span>
            <input type="date" value={filterTo} min={filterFrom} onChange={(e) => setFilterTo(e.target.value)} className={`${inputClass} min-w-0 flex-1 sm:flex-none`} aria-label="Hasta" />
          </div>
          <select value={filterMedio} onChange={(e) => setFilterMedio(e.target.value)} className={inputClass}>
            {MEDIOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {loading && <Loader2 className="w-5 h-5 text-brand-orange animate-spin shrink-0" />}
        </div>

        {cargaError && (
          <ErrorBanner className="mt-3" onRetry={() => window.location.reload()}>{cargaError}</ErrorBanner>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 mb-6">
        <StatCard highlight label="Total cobrado" value={formatMoney(stats.total)} icon={<DollarSign />}
          detail={`${filteredPagos.length} pago${filteredPagos.length !== 1 ? "s" : ""}`} loading={loading} />
        {stats.porMedio.map(({ medio, monto, count }) => (
          <StatCard key={medio} label={medio} value={formatMoney(monto)} icon={<CreditCard className="text-gray-400" />}
            detail={`${count} pago${count !== 1 ? "s" : ""}`} loading={loading} />
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
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
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-blue-400 hover:bg-brand-navy/20 transition-colors text-xs"
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
                          className="p-1.5 text-gray-400 hover:text-brand-orange hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
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

      {/* Vista previa del comprobante */}
      {previewUrl && (
        <Modal
          open
          onClose={() => setPreviewUrl(null)}
          title="Comprobante de pago"
          size="md"
          bodyClassName="p-0"
          footer={
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
              <ExternalLink className="w-4 h-4" /> Abrir en otra pestaña
            </a>
          }
        >
          <ImageWithFallback src={previewUrl} alt="Comprobante" className="w-full max-h-[65vh] object-contain bg-gray-50 dark:bg-gray-900" />
        </Modal>
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
          if (!open) { setDeletingPago(null); setDeletePagoError(""); }
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
        error={deletePagoError}
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
      const { url: normalizedUrl } = await apiUpload(file, "comprobantes");
      setComprobanteUrl(normalizedUrl);
    } catch (err) {
      setModalError(mensajeDeError(err, "No se pudo subir el comprobante."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadFile(file);
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
    if (!montoNumerico || montoNumerico <= 0) {
      setModalError("Ingresa un monto mayor a S/ 0.00.");
      return;
    }
    if (isUploading) {
      setModalError("Espera a que termine de subirse el comprobante.");
      return;
    }

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
            await apiRequest("/upload", { method: "DELETE", body: JSON.stringify({ path }), silencioso: true });
          } catch {
            // best-effort cleanup: an orphaned file in storage is not worth blocking the user over
          }
        }
      }

      onClose();
    } catch (err) {
      setModalError(mensajeDeError(err, "No se pudo guardar el pago."));
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = campo;

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar Pago"
      description={`Ficha #${pago.fichaId} · ${pago.clienteNombre}`}
      busy={isSaving}
      error={modalError || undefined}
      footer={
        <>
          <Button type="button" variant="subtle" size="lg" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" form="pago-form" variant="brand" size="lg" loading={isSaving} disabled={isUploading}>
            {isSaving ? "Guardando..." : isUploading ? "Subiendo comprobante..." : "Guardar cambios"}
          </Button>
        </>
      }
    >
        <form id="pago-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={etiqueta}>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={etiqueta}>Monto</label>
            <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={etiqueta}>Medio de pago</label>
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputClass}>
              <option value="Transferencia">Transferencia</option>
              <option value="Yape">Yape</option>
              <option value="Plin">Plin</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Link de Pago">Link de Pago</option>
            </select>
          </div>

          <div>
            <label className={etiqueta}>Número de operación</label>
            <input type="text" value={numeroOperacion} onChange={(e) => setNumeroOperacion(e.target.value)} placeholder="Opcional" className={inputClass} />
          </div>

          <div>
            <label className={etiqueta}>Comprobante</label>
            <div
              tabIndex={0}
              onPaste={(e) => void handlePaste(e)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange ${
                isUploading ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400" : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
              }`}
            >
              <label className={`flex cursor-pointer items-center justify-center gap-2 text-sm ${isUploading ? "cursor-not-allowed" : "hover:text-brand-orange"}`}>
                <Upload className="w-4 h-4" />
                <span>{isUploading ? "Subiendo..." : "Subir imagen del comprobante"}</span>
                <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} className="hidden" />
              </label>
              <span className="text-xs text-gray-400 dark:text-gray-500">o haz clic aquí y pega una imagen (Ctrl+V)</span>
            </div>
            {comprobanteUrl && (
              <div className="mt-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <ImageWithFallback src={comprobanteUrl} alt="Vista previa del comprobante" className="max-h-48 w-full object-contain bg-black/5" />
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
        </form>
    </Modal>
  );
}
