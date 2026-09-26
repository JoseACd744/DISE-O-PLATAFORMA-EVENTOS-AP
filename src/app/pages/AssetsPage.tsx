import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Edit2, Trash2, Box, X, Layers, DollarSign, Loader2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import { StatCard } from "../components/ui/stat-card";
import { PageHeader } from "../components/ui/page-header";
import { ErrorBanner } from "../components/ui/feedback";
import { mensajeDeError, notify } from "../lib/notify";
import { isAdminUser } from "../lib/auth";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { campo, etiqueta } from "../lib/ui";

// ── Types ──────────────────────────────────────────────────────────────────

interface Activo {
  id: number;
  nombre: string;
  cantidad: number;
  costo: number;
  created_at: string;
}

type ActivoForm = {
  nombre: string;
  cantidad: string;
  costo: string;
};

const emptyForm: ActivoForm = {
  nombre: "",
  cantidad: "0",
  costo: "0",
};

function formatMoney(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Component ──────────────────────────────────────────────────────────────

export function AssetsPage() {
  const isAdmin = isAdminUser();

  const [assets, setAssets] = useState<Activo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ActivoForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Data ──────────────────────────────────────────────────────────────

  const loadAssets = async () => {
    setError("");
    try {
      const data = await apiRequest<Activo[]>("/activos");
      setAssets(data);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudieron cargar los activos."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAssets(); }, []);

  const filtered = assets.filter(
    a => a.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => ({
    totalActivos: assets.length,
    totalUnidades: assets.reduce((s, a) => s + a.cantidad, 0),
    valorTotal: assets.reduce((s, a) => s + a.cantidad * a.costo, 0),
  }), [assets]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (a: Activo) => {
    setEditingId(a.id);
    setForm({
      nombre: a.nombre,
      cantidad: a.cantidad.toString(),
      costo: a.costo.toString(),
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return setFormError("Ingresa el nombre del activo.");
    if (Number(form.cantidad) < 0 || Number(form.costo) < 0) return setFormError("La cantidad y el costo no pueden ser negativos.");

    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        nombre: form.nombre.trim(),
        cantidad: parseInt(form.cantidad) || 0,
        costo: parseFloat(form.costo) || 0,
      };

      if (editingId) {
        await apiRequest(`/activos/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/activos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowForm(false);
      notify.ok(editingId ? `Activo «${payload.nombre}» actualizado` : `Activo «${payload.nombre}» creado`);
      try {
        await loadAssets();
      } catch {
        notify.aviso("Se guardó, pero no se pudo actualizar la lista. Recarga la página.");
      }
    } catch (err) {
      setFormError(mensajeDeError(err, "No se pudo guardar el activo."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      await apiRequest(`/activos/${deleteTarget.id}`, { method: "DELETE" });
      notify.ok(`Activo «${deleteTarget.label}» eliminado`);
      setDeleteTarget(null);
      await loadAssets();
    } catch (err) {
      setDeleteError(mensajeDeError(err, "No se pudo eliminar el activo."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const inputClass = campo;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader
        title="Gestión de Activos"
        subtitle="Inventario general de equipos y recursos"
        actions={isAdmin && (
          <Button variant="navy" onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Nuevo Activo
          </Button>
        )}
      />

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard label="Total de Activos" value={stats.totalActivos} icon={<Box />} tone="navy" loading={loading} />
        <StatCard label="Unidades en Stock" value={stats.totalUnidades} icon={<Layers />} tone="green" loading={loading} />
        <StatCard highlight label="Valor del Inventario" value={formatMoney(stats.valorTotal)} icon={<DollarSign />}
          loading={loading} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
            Cargando activos...
          </div>
        ) : error ? (
          <ErrorBanner className="m-4" onRetry={loadAssets}>{error}</ErrorBanner>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Box className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {assets.length === 0 ? "Aún no hay activos registrados" : "No se encontraron activos con ese criterio"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Activo</th>
                  <th className="text-center py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cantidad</th>
                  <th className="text-right py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Costo Unitario</th>
                  <th className="text-right py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Valor Total</th>
                  <th className="text-right py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Creado</th>
                  {isAdmin && <th className="text-right py-3 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-navy/10 dark:bg-brand-navy/20 flex items-center justify-center shrink-0">
                          <Box className="w-4 h-4 text-brand-navy dark:text-blue-400" />
                        </div>
                        <span className="text-gray-900 dark:text-white">{asset.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {asset.cantidad}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">{formatMoney(asset.costo)}</td>
                    <td className="py-3 px-4 text-right text-gray-900 dark:text-white">{formatMoney(asset.cantidad * asset.costo)}</td>
                    <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-500 whitespace-nowrap">{formatDate(asset.created_at)}</td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(asset)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: asset.id, label: asset.nombre })}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                    {filtered.length} activo{filtered.length !== 1 ? "s" : ""}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                    {formatMoney(filtered.reduce((s, a) => s + a.cantidad * a.costo, 0))}
                  </td>
                  <td colSpan={isAdmin ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <Modal
          open
          onClose={() => setShowForm(false)}
          title={editingId ? "Editar Activo" : "Nuevo Activo"}
          size="sm"
          busy={submitting}
          error={formError || undefined}
          footer={<>
            <Button type="button" variant="subtle" size="lg" onClick={() => setShowForm(false)} disabled={submitting}>Cancelar</Button>
            <Button type="submit" form="activo-form" variant="navy" size="lg" loading={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </>}
        >

            <form id="activo-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={etiqueta}>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className={inputClass}
                  placeholder="Ej: Insuflador Industrial"
                  autoFocus
                  aria-label="Nombre"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>Cantidad</label>
                  <input
                    type="number"
                    value={form.cantidad}
                    onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                    className={inputClass}
                    min="0"
                  />
                </div>
                <div>
                  <label className={etiqueta}>Costo (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.costo}
                    onChange={(e) => setForm({ ...form, costo: e.target.value })}
                    className={inputClass}
                    min="0"
                  />
                </div>
              </div>

            </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(""); } }}
        onConfirm={handleDelete}
        title="Eliminar Activo"
        description={`¿Estás seguro que deseas eliminar "${deleteTarget?.label}"? Esta acción no se puede deshacer.`}
        loading={deleteSubmitting}
        error={deleteError}
      />
    </div>
  );
}
