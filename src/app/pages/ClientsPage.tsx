import { useEffect, useState, useRef } from "react";
import { Search, Plus, Phone, Mail, MapPin, Edit2, Trash2, Package, X, Filter, Building2 } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { useBrand, Brand } from "../contexts/BrandContext";
import { apiRequest } from "../lib/api";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import { StatCard } from "../components/ui/stat-card";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState, ErrorBanner } from "../components/ui/feedback";
import { mensajeDeError, notify } from "../lib/notify";
import { invalidarClientes } from "../lib/queries";
import { canManageClients } from "../lib/auth";
import { campo, etiqueta } from "../lib/ui";

// Canales de adquisición disponibles. Si un cliente antiguo tiene un canal
// que no está en esta lista, el selector lo agrega para no perder el dato.
const CANALES = [
  "Referidos",
  "Staff",
  "Redes",
  "Instagram",
  "Facebook",
  "TikTok",
  "WhatsApp",
  "Google",
  "Pagina Web",
  "Otro",
];

function canalesDisponibles(actual?: string) {
  return actual && !CANALES.includes(actual) ? [actual, ...CANALES] : CANALES;
}

interface Client {
  id: string;
  nombre: string;
  razonSocial: string;
  dniRuc: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  canal: string;
  totalOrders: number;
  lastOrder: string;
  status: "active" | "inactive";
  creadoPor: "donofrio" | "jugueton";
  anioRegistro: number | null;
  fichasBase: number;
  recomendaciones: number;
  fichasReales: number;
  totalFichas: number;
}

const ITEMS_PER_PAGE = 10;

type BrandFilter = "todos" | "donofrio" | "jugueton";

function formatearUltimoPedido(valor: string) {
  if (!valor) return "—";
  const fecha = new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T00:00:00` : valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientsPage() {
  const canManage = canManageClients();
  const { brand } = useBrand();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(brand || "todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [deleteClientSubmitting, setDeleteClientSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const clientSaveLockRef = useRef(false);
  const [newClient, setNewClient] = useState({
    nombre: "",
    razonSocial: "",
    dniRuc: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    canal: "Referidos" as Client["canal"],
    status: "active" as "active" | "inactive",
    creadoPor: (brand || "donofrio") as "donofrio" | "jugueton",
    anioRegistro: "",
    fichasBase: 0,
    recomendaciones: 0,
  });

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.dniRuc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = brandFilter === "todos" || client.creadoPor === brandFilter;
    return matchesSearch && matchesBrand;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedClients = filteredClients.slice(startIndex, endIndex);

  // Reset to page 1 when search/filter changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleBrandFilterChange = (value: BrandFilter) => {
    setBrandFilter(value);
    setCurrentPage(1);
  };

  const loadClients = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<Array<{
        id: string;
        nombre: string;
        razon_social: string | null;
        dni_ruc: string | null;
        email: string | null;
        telefono: string | null;
        direccion: string | null;
        ciudad: string | null;
        canal: Client["canal"] | null;
        total_orders: number;
        last_order: string | null;
        status: Client["status"];
        creado_por: Client["creadoPor"];
        anio_registro: number | null;
        fichas_base: number;
        recomendaciones: number;
        fichas_reales: number;
        total_fichas: number;
      }>>("/clients");

      setClients(
        data.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          razonSocial: c.razon_social || "",
          dniRuc: c.dni_ruc || "",
          email: c.email || "",
          phone: c.telefono || "",
          address: c.direccion || "",
          city: c.ciudad || "",
          canal: c.canal || "",
          totalOrders: c.total_orders || 0,
          lastOrder: c.last_order || "",
          status: c.status,
          anioRegistro: c.anio_registro ?? null,
          fichasBase: c.fichas_base || 0,
          recomendaciones: c.recomendaciones || 0,
          fichasReales: c.fichas_reales || 0,
          totalFichas: c.total_fichas || 0,
          creadoPor: c.creado_por,
        }))
      );
    } catch (err) {
      setError(mensajeDeError(err, "No se pudieron cargar los clientes."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const validarCliente = (c: { nombre: string; phone: string; address: string; city: string }) => {
    const faltan = [
      !c.nombre.trim() && "nombre",
      !c.phone.trim() && "teléfono",
      !c.address.trim() && "dirección",
      !c.city.trim() && "ciudad",
    ].filter(Boolean);
    return faltan.length ? `Completa los campos obligatorios: ${faltan.join(", ")}.` : "";
  };

  const handleAddClient = async () => {
    if (clientSaveLockRef.current || isSavingClient) return;
    const invalido = validarCliente(newClient);
    if (invalido) {
      setFormError(invalido);
      return;
    }

    clientSaveLockRef.current = true;
    setIsSavingClient(true);
    setFormError("");

    try {
      await apiRequest("/clients", {
        method: "POST",
        body: JSON.stringify({
          nombre: newClient.nombre,
          razon_social: newClient.razonSocial || null,
          dni_ruc: newClient.dniRuc || null,
          email: newClient.email || null,
          telefono: newClient.phone,
          direccion: newClient.address,
          ciudad: newClient.city,
          canal: newClient.canal || null,
          status: newClient.status,
          creado_por: newClient.creadoPor,
          anio_registro: newClient.anioRegistro ? Number(newClient.anioRegistro) : null,
          fichas_base: Number(newClient.fichasBase) || 0,
          recomendaciones: Number(newClient.recomendaciones) || 0,
        }),
      });

      setShowAddModal(false);
      notify.ok(`Cliente «${newClient.nombre.trim()}» creado`);
      setNewClient({ nombre: "", razonSocial: "", dniRuc: "", email: "", phone: "", address: "", city: "", canal: "Referidos", status: "active", creadoPor: (brand || "donofrio") as "donofrio" | "jugueton", anioRegistro: "", fichasBase: 0, recomendaciones: 0 });
      invalidarClientes();
      await loadClients();
    } catch (err) {
      setFormError(mensajeDeError(err, "No se pudo crear el cliente."));
    } finally {
      clientSaveLockRef.current = false;
      setIsSavingClient(false);
    }
  };

  const handleEditClient = async () => {
    if (!editingClient) return;
    if (clientSaveLockRef.current || isSavingClient) return;
    const invalido = validarCliente(editingClient);
    if (invalido) {
      setFormError(invalido);
      return;
    }

    clientSaveLockRef.current = true;
    setIsSavingClient(true);
    setFormError("");

    try {
      await apiRequest(`/clients/${editingClient.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre: editingClient.nombre,
          razon_social: editingClient.razonSocial || null,
          dni_ruc: editingClient.dniRuc || null,
          email: editingClient.email || null,
          telefono: editingClient.phone,
          direccion: editingClient.address,
          ciudad: editingClient.city,
          canal: editingClient.canal || null,
          status: editingClient.status,
          anio_registro: editingClient.anioRegistro,
          fichas_base: editingClient.fichasBase,
          recomendaciones: editingClient.recomendaciones,
        }),
      });

      setEditingClient(null);
      notify.ok(`Cliente «${editingClient.nombre.trim()}» actualizado`);
      invalidarClientes();
      await loadClients();
    } catch (err) {
      setFormError(mensajeDeError(err, "No se pudo actualizar el cliente."));
    } finally {
      clientSaveLockRef.current = false;
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    setDeleteClientId(id);
  };

  const confirmDeleteClient = async () => {
    if (!deleteClientId) return;

    setDeleteClientSubmitting(true);
    setDeleteError("");
    try {
      await apiRequest(`/clients/${deleteClientId}`, { method: "DELETE" });
      const nombre = clients.find((c) => c.id === deleteClientId)?.nombre;
      setDeleteClientId(null);
      notify.ok(nombre ? `Cliente «${nombre}» eliminado` : "Cliente eliminado");
      invalidarClientes();
      await loadClients();
    } catch (err) {
      setDeleteError(mensajeDeError(err, "No se pudo eliminar el cliente."));
    } finally {
      setDeleteClientSubmitting(false);
    }
  };

  const getBrandBadge = (creadoPor: "donofrio" | "jugueton") => {
    if (creadoPor === "donofrio") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-brand-navy/10 dark:bg-brand-navy/20 text-brand-navy dark:text-blue-400">
          D'Onofrio
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange">
        Juguetón
      </span>
    );
  };

  // Counts
  const countDonofrio = clients.filter((c) => c.creadoPor === "donofrio").length;
  const countJugueton = clients.filter((c) => c.creadoPor === "jugueton").length;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <DeleteConfirmDialog
        open={deleteClientId !== null}
        onOpenChange={(open) => {
          if (!open) { setDeleteClientId(null); setDeleteError(""); }
        }}
        title="Eliminar cliente"
        description="¿Seguro que quieres eliminar este cliente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar cliente"
        loadingLabel="Eliminando..."
        loading={deleteClientSubmitting}
        onConfirm={confirmDeleteClient}
        error={deleteError}
      />
      <PageHeader
        title="Cartera de Clientes"
        subtitle="Base de datos compartida - filtra por marca creadora"
        actions={canManage && (
          <Button variant="brand" size="lg" onClick={() => { setFormError(""); setShowAddModal(true); }} className="w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </Button>
        )}
      />

      {error ? (
        <ErrorBanner className="mb-4" onRetry={loadClients}>{error}</ErrorBanner>
      ) : null}

      {/* Search, Brand Filter and Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4 mb-6">
        <div className="col-span-2 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, dirección o ciudad..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
            />
          </div>
        </div>

        {/* Brand Filter Buttons */}
        <div className="col-span-2 xl:col-span-1 min-w-0 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Creado por</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handleBrandFilterChange("todos")}
              className={`flex-1 whitespace-nowrap px-2 py-1.5 rounded-md text-xs transition-colors ${
                brandFilter === "todos"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Todos ({clients.length})
            </button>
            <button
              onClick={() => handleBrandFilterChange("donofrio")}
              className={`flex-1 whitespace-nowrap px-2 py-1.5 rounded-md text-xs transition-colors ${
                brandFilter === "donofrio"
                  ? "bg-brand-navy text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              D'O ({countDonofrio})
            </button>
            <button
              onClick={() => handleBrandFilterChange("jugueton")}
              className={`flex-1 whitespace-nowrap px-2 py-1.5 rounded-md text-xs transition-colors ${
                brandFilter === "jugueton"
                  ? "bg-brand-orange text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Jug ({countJugueton})
            </button>
          </div>
        </div>

        <StatCard label="Total Clientes" value={clients.length} icon={<Package />} tone="navy" loading={loading} />
        <StatCard label="Mostrando" value={filteredClients.length} icon={<Filter />} tone="orange" loading={loading} />
      </div>

      {/* Clients Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Creado por</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Canal</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Año</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fichas</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Recom.</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Último Pedido</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                {canManage && <th className="px-6 py-4 text-center text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 11 : 10} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Cargando clientes...
                  </td>
                </tr>
              ) : null}
              {paginatedClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{client.nombre}</p>
                      {client.razonSocial ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{client.razonSocial}</p>
                      ) : null}
                      {client.dniRuc ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">DNI/RUC: {client.dniRuc}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="w-4 h-4" />
                        {client.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="w-4 h-4" />
                        {client.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{client.address}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{client.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getBrandBadge(client.creadoPor)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange">
                      {client.canal || "Sin canal"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{client.anioRegistro ?? "—"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 dark:text-white" title={`${client.fichasBase} base + ${client.fichasReales} en el sistema`}>{client.totalFichas}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{client.recomendaciones}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatearUltimoPedido(client.lastOrder)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                        client.status === "active"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {client.status === "active" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setFormError(""); setEditingClient({ ...client }); }}
                          aria-label={`Editar ${client.nombre}`}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          aria-label={`Eliminar ${client.nombre}`}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredClients.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredClients.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>

      {!loading && !error && filteredClients.length === 0 && (
        <EmptyState className="mt-6" title={clients.length === 0 ? "Aún no hay clientes registrados" : "No se encontraron clientes con estos filtros"} />
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <Modal
          open
          onClose={() => setShowAddModal(false)}
          title="Nuevo Cliente"
          size="md"
          busy={isSavingClient}
          error={formError || undefined}
          footer={<>
            <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddClient}
                  disabled={isSavingClient}
                  className="flex-1 bg-brand-orange text-white px-4 py-3 rounded-lg hover:bg-brand-orange-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingClient ? "Guardando..." : "Guardar Cliente"}
                </button>
          </>}
        >
            <div className="space-y-4">
              <div>
                <label className={etiqueta}>Marca *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewClient({ ...newClient, creadoPor: "donofrio" })}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      newClient.creadoPor === "donofrio"
                        ? "bg-brand-navy text-white border-brand-navy"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    D'Onofrio
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewClient({ ...newClient, creadoPor: "jugueton" })}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      newClient.creadoPor === "jugueton"
                        ? "bg-brand-orange text-white border-brand-orange"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    Juguetón
                  </button>
                </div>
              </div>
              <div>
                <label className={etiqueta}>Nombre *</label>
                <input
                  type="text"
                  value={newClient.nombre}
                  onChange={(e) => setNewClient({ ...newClient, nombre: e.target.value })}
                  placeholder="Ej: Maria Lopez"
                  className={campo}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>Razón Social (opcional)</label>
                  <input
                    type="text"
                    value={newClient.razonSocial}
                    onChange={(e) => setNewClient({ ...newClient, razonSocial: e.target.value })}
                    placeholder="Ej: Inversiones Lopez SAC"
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>DNI/RUC (opcional)</label>
                  <input
                    type="text"
                    value={newClient.dniRuc}
                    onChange={(e) => setNewClient({ ...newClient, dniRuc: e.target.value })}
                    placeholder="Ej: 12345678 o 20123456789"
                    className={campo}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>Teléfono *</label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="+51 987 654 321"
                    className={campo}
                  />
                </div>
              </div>
              <div>
                <label className={etiqueta}>Dirección *</label>
                <input
                  type="text"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  placeholder="Av. Principal 123"
                  className={campo}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>Distrito / Ciudad *</label>
                  <input
                    type="text"
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    placeholder="Miraflores"
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>Canal de adquisición</label>
                  <select
                    value={newClient.canal}
                    onChange={(e) => setNewClient({ ...newClient, canal: e.target.value })}
                    className={campo}
                  >
                    <option value="">Sin canal</option>
                    {canalesDisponibles(newClient.canal).map((canal) => (
                      <option key={canal} value={canal}>{canal}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiqueta}>Estado</label>
                  <select
                    value={newClient.status}
                    onChange={(e) => setNewClient({ ...newClient, status: e.target.value as "active" | "inactive" })}
                    className={campo}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={etiqueta}>Año del cliente</label>
                  <input
                    type="number"
                    value={newClient.anioRegistro}
                    onChange={(e) => setNewClient({ ...newClient, anioRegistro: e.target.value })}
                    placeholder="Ej: 2022"
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>Fichas base</label>
                  <input
                    type="number"
                    min={0}
                    value={newClient.fichasBase}
                    onChange={(e) => setNewClient({ ...newClient, fichasBase: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className={campo}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Fichas que tuvo antes de registrarse en el sistema</p>
                </div>
                <div>
                  <label className={etiqueta}>Recomendaciones</label>
                  <input
                    type="number"
                    min={0}
                    value={newClient.recomendaciones}
                    onChange={(e) => setNewClient({ ...newClient, recomendaciones: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className={campo}
                  />
                </div>
              </div>
              
            </div>
        </Modal>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <Modal
          open
          onClose={() => setEditingClient(null)}
          title="Editar Cliente"
          size="md"
          busy={isSavingClient}
          error={formError || undefined}
          footer={<>
            <button
                  onClick={() => setEditingClient(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditClient}
                  disabled={isSavingClient}
                  className="flex-1 bg-brand-navy text-white px-4 py-3 rounded-lg hover:bg-brand-navy/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingClient ? "Guardando..." : "Actualizar Cliente"}
                </button>
          </>}
        >
            <div className="mb-6">{getBrandBadge(editingClient.creadoPor)}</div>
            <div className="space-y-4">
              <div>
                <label className={etiqueta}>Nombre *</label>
                <input
                  type="text"
                  value={editingClient.nombre}
                  onChange={(e) => setEditingClient({ ...editingClient, nombre: e.target.value })}
                  className={campo}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>Razón Social (opcional)</label>
                  <input
                    type="text"
                    value={editingClient.razonSocial}
                    onChange={(e) => setEditingClient({ ...editingClient, razonSocial: e.target.value })}
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>DNI/RUC (opcional)</label>
                  <input
                    type="text"
                    value={editingClient.dniRuc}
                    onChange={(e) => setEditingClient({ ...editingClient, dniRuc: e.target.value })}
                    className={campo}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>Email</label>
                  <input
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>Teléfono *</label>
                  <input
                    type="tel"
                    value={editingClient.phone}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    className={campo}
                  />
                </div>
              </div>
              <div>
                <label className={etiqueta}>Dirección *</label>
                <input
                  type="text"
                  value={editingClient.address}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  className={campo}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={etiqueta}>Distrito / Ciudad *</label>
                  <input
                    type="text"
                    value={editingClient.city}
                    onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>Canal de adquisición</label>
                  <select
                    value={editingClient.canal}
                    onChange={(e) => setEditingClient({ ...editingClient, canal: e.target.value })}
                    className={campo}
                  >
                    <option value="">Sin canal</option>
                    {canalesDisponibles(editingClient.canal).map((canal) => (
                      <option key={canal} value={canal}>{canal}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiqueta}>Estado</label>
                  <select
                    value={editingClient.status}
                    onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value as "active" | "inactive" })}
                    className={campo}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={etiqueta}>Año del cliente</label>
                  <input
                    type="number"
                    value={editingClient.anioRegistro ?? ""}
                    onChange={(e) => setEditingClient({ ...editingClient, anioRegistro: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ej: 2022"
                    className={campo}
                  />
                </div>
                <div>
                  <label className={etiqueta}>Fichas base</label>
                  <input
                    type="number"
                    min={0}
                    value={editingClient.fichasBase}
                    onChange={(e) => setEditingClient({ ...editingClient, fichasBase: Number(e.target.value) || 0 })}
                    className={campo}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Fichas reales en el sistema: {editingClient.fichasReales}</p>
                </div>
                <div>
                  <label className={etiqueta}>Recomendaciones</label>
                  <input
                    type="number"
                    min={0}
                    value={editingClient.recomendaciones}
                    onChange={(e) => setEditingClient({ ...editingClient, recomendaciones: Number(e.target.value) || 0 })}
                    className={campo}
                  />
                </div>
              </div>
              
            </div>
        </Modal>
      )}
    </div>
  );
}

