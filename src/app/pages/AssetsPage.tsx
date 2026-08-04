import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Edit2, Trash2, Box, X, Layers, DollarSign, Loader2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { isAdminUser } from "../lib/auth";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";

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

  // ── Data ──────────────────────────────────────────────────────────────

  const loadAssets = async () => {
    setError("");
    try {
      const data = await apiRequest<Activo[]>("/activos");
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los activos");
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
    if (!form.nombre.trim()) return setFormError("El nombre es requerido");

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

      await loadAssets();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await apiRequest(`/activos/${deleteTarget.id}`, { method: "DELETE" });
      await loadAssets();
      setDeleteTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const inputClass = "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F3C8B]";

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Gestión de Activos</h1>
          <p className="text-gray-600 dark:text-gray-400">Inventario general de equipos y recursos</p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-[#1F3C8B] text-white px-4 py-2 rounded-lg hover:bg-[#162a63] transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo Activo
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 p-2 rounded-lg">
              <Box className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Total de Activos</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{stats.totalActivos}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
              <Layers className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Unidades en Stock</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{stats.totalUnidades}</p>
        </div>
        <div className="bg-[#1F3C8B] text-white rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/10 p-2 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-sm opacity-80">Valor del Inventario</span>
          </div>
          <p className="text-3xl">{formatMoney(stats.valorTotal)}</p>
        </div>
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F3C8B] text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#1F3C8B] animate-spin" />
            Cargando activos...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 text-sm">{error}</div>
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
                        <div className="w-8 h-8 rounded-lg bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 flex items-center justify-center shrink-0">
                          <Box className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6">
              {editingId ? "Editar Activo" : "Nuevo Activo"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-100 dark:border-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className={inputClass}
                  placeholder="Ej: Insuflador Industrial"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                  <input
                    type="number"
                    value={form.cantidad}
                    onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                    className={inputClass}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Costo (S/)</label>
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

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-[#1F3C8B] text-white rounded-lg hover:bg-[#162a63] disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleDelete}
        title="Eliminar Activo"
        description={`¿Estás seguro que deseas eliminar "${deleteTarget?.label}"? Esta acción no se puede deshacer.`}
        loading={deleteSubmitting}
      />
    </div>
  );
}
