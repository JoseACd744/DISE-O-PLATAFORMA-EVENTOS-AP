import { useEffect, useState } from "react";
import { Search, Plus, Phone, Mail, MapPin, Edit2, Trash2, Package, X, Filter, Building2 } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { useBrand, Brand } from "../contexts/BrandContext";
import { apiRequest } from "../lib/api";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  canal: "Referidos" | "Pagina Web" | "Google" | "TikTok" | "Instagram" | "Facebook";
  totalOrders: number;
  lastOrder: string;
  status: "active" | "inactive";
  creadoPor: "donofrio" | "jugueton";
}

const ITEMS_PER_PAGE = 10;

type BrandFilter = "todos" | "donofrio" | "jugueton";

export function ClientsPage() {
  const { brand } = useBrand();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(brand || "todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    canal: "Referidos" as Client["canal"],
    status: "active" as "active" | "inactive",
  });

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        email: string | null;
        telefono: string | null;
        direccion: string | null;
        ciudad: string | null;
        canal: Client["canal"] | null;
        total_orders: number;
        last_order: string | null;
        status: Client["status"];
        creado_por: Client["creadoPor"];
      }>>("/clients");

      setClients(
        data.map((c) => ({
          id: c.id,
          name: c.nombre,
          email: c.email || "",
          phone: c.telefono || "",
          address: c.direccion || "",
          city: c.ciudad || "",
          canal: c.canal || "Referidos",
          totalOrders: c.total_orders || 0,
          lastOrder: c.last_order || "",
          status: c.status,
          creadoPor: c.creado_por,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone || !newClient.address || !newClient.city) return;

    try {
      await apiRequest("/clients", {
        method: "POST",
        body: JSON.stringify({
          nombre: newClient.name,
          email: newClient.email || null,
          telefono: newClient.phone,
          direccion: newClient.address,
          ciudad: newClient.city,
          canal: newClient.canal,
          status: newClient.status,
          creado_por: (brand || "donofrio") as "donofrio" | "jugueton",
        }),
      });

      setShowAddModal(false);
      setNewClient({ name: "", email: "", phone: "", address: "", city: "", canal: "Referidos", status: "active" });
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente");
    }
  };

  const handleEditClient = async () => {
    if (!editingClient) return;

    try {
      await apiRequest(`/clients/${editingClient.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre: editingClient.name,
          email: editingClient.email || null,
          telefono: editingClient.phone,
          direccion: editingClient.address,
          ciudad: editingClient.city,
          canal: editingClient.canal,
          status: editingClient.status,
        }),
      });

      setEditingClient(null);
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el cliente");
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await apiRequest(`/clients/${id}`, { method: "DELETE" });
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el cliente");
    }
  };

  const getBrandBadge = (creadoPor: "donofrio" | "jugueton") => {
    if (creadoPor === "donofrio") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 text-[#1F3C8B] dark:text-blue-400">
          D'Onofrio
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#EF8022]/10 dark:bg-[#EF8022]/20 text-[#EF8022]">
        JuguetÃ³n
      </span>
    );
  };

  // Counts
  const countDonofrio = clients.filter((c) => c.creadoPor === "donofrio").length;
  const countJugueton = clients.filter((c) => c.creadoPor === "jugueton").length;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Cartera de Clientes</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Base de datos compartida â€” filtra por marca creadora
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search, Brand Filter and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6">
        <div className="md:col-span-2 lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, direcciÃ³n o ciudad..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
            />
          </div>
        </div>

        {/* Brand Filter Buttons */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Creado por</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleBrandFilterChange("todos")}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                brandFilter === "todos"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Todos ({clients.length})
            </button>
            <button
              onClick={() => handleBrandFilterChange("donofrio")}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                brandFilter === "donofrio"
                  ? "bg-[#1F3C8B] text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              D'O ({countDonofrio})
            </button>
            <button
              onClick={() => handleBrandFilterChange("jugueton")}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                brandFilter === "jugueton"
                  ? "bg-[#EF8022] text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Jug ({countJugueton})
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 p-2 rounded-lg">
              <Package className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Clientes</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{clients.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#EF8022]/10 dark:bg-[#EF8022]/20 p-2 rounded-lg">
              <Filter className="w-5 h-5 text-[#EF8022]" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Mostrando</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{filteredClients.length}</p>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">UbicaciÃ³n</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Creado por</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Canal</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Pedidos</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Ãšltimo Pedido</th>
                <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-center text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Cargando clientes...
                  </td>
                </tr>
              ) : null}
              {paginatedClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{client.name}</p>
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-[#EF8022]/10 dark:bg-[#EF8022]/20 text-[#EF8022]">
                      {client.canal}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 dark:text-white">{client.totalOrders}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(client.lastOrder).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
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
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEditingClient({ ...client })}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
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

      {filteredClients.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mt-6">
          <p className="text-gray-500 dark:text-gray-400">No se encontraron clientes</p>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl text-gray-900 dark:text-white mb-2">Nuevo Cliente</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Se asignarÃ¡ automÃ¡ticamente a{" "}
              <span className={brand === "donofrio" ? "text-[#1F3C8B]" : "text-[#EF8022]"}>
                {brand === "donofrio" ? "D'Onofrio" : "JuguetÃ³n"}
              </span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre / RazÃ³n Social *</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Ej: Bodega San MartÃ­n"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">TelÃ©fono *</label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="+51 987 654 321"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">DirecciÃ³n *</label>
                <input
                  type="text"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  placeholder="Av. Principal 123"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Distrito / Ciudad *</label>
                  <input
                    type="text"
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    placeholder="Miraflores"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Canal de adquisiciÃ³n</label>
                  <select
                    value={newClient.canal}
                    onChange={(e) => setNewClient({ ...newClient, canal: e.target.value as Client["canal"] })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="Referidos">Referidos</option>
                    <option value="Pagina Web">Pagina Web</option>
                    <option value="Google">Google</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                  <select
                    value={newClient.status}
                    onChange={(e) => setNewClient({ ...newClient, status: e.target.value as "active" | "inactive" })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddClient}
                  className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors"
                >
                  Guardar Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full relative">
            <button
              onClick={() => setEditingClient(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl text-gray-900 dark:text-white mb-2">Editar Cliente</h2>
            <div className="mb-6">{getBrandBadge(editingClient.creadoPor)}</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre / RazÃ³n Social *</label>
                <input
                  type="text"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">TelÃ©fono *</label>
                  <input
                    type="tel"
                    value={editingClient.phone}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">DirecciÃ³n *</label>
                <input
                  type="text"
                  value={editingClient.address}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Distrito / Ciudad *</label>
                  <input
                    type="text"
                    value={editingClient.city}
                    onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Canal de adquisiciÃ³n</label>
                  <select
                    value={editingClient.canal}
                    onChange={(e) => setEditingClient({ ...editingClient, canal: e.target.value as Client["canal"] })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="Referidos">Referidos</option>
                    <option value="Pagina Web">Pagina Web</option>
                    <option value="Google">Google</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                  <select
                    value={editingClient.status}
                    onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value as "active" | "inactive" })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingClient(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditClient}
                  className="flex-1 bg-[#1F3C8B] text-white px-4 py-3 rounded-lg hover:bg-[#1F3C8B]/90 transition-colors"
                >
                  Actualizar Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

