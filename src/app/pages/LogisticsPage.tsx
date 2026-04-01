import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { User, Truck, MapPin, Shield, Search, Plus, Edit, CheckCircle2, AlertTriangle, X, ChevronRight, Trash2, Coffee, Map } from "lucide-react";
import { useBrand } from "../contexts/BrandContext";
import { apiRequest } from "../lib/api";

// ── Types ────────────────────────────────────────────────────────

type EstadoChofer = "disponible" | "en-ruta" | "descanso";
type EstadoVehiculo = "disponible" | "en-ruta" | "mantenimiento";

interface Chofer {
  id: number;
  nombre: string;
  dni: string;
  celular: string;
  licencia: string;
  estado: EstadoChofer;
  foto?: string;
  rutasCompletadas: number;
}

interface Vehiculo {
  id: number;
  placa: string;
  modelo: string;
  marca: string; // marca del vehículo (Toyota, Hyundai, etc.)
  capacidad: number; // en kg
  marcasAsignadas: ("donofrio" | "jugueton")[]; // brands it can serve
  estado: EstadoVehiculo;
  ultimoMantenimiento: string;
  kmActual: number;
}

interface Asignacion {
  id: number;
  choferId: number;
  vehiculoId: number;
  fecha: string;
  ruta: string;
  entregas: number;
  marcaEntregas: ("donofrio" | "jugueton")[];
  estado: "programada" | "en-curso" | "completada";
  fichasIds: number[];
}

interface FichaResumen {
  id: number;
  clienteNombre: string;
  distrito: string;
  direccion: string;
  fecha: string;
  horaEntrega: string;
  horaRecojo: string;
  carrito: number;
}

const MAX_CARRITOS_POR_VEHICULO = 5;

// ── Badge Components ─────────────────────────────────────────────

function EstadoChoferBadge({ estado }: { estado: EstadoChofer }) {
  const config: Record<EstadoChofer, { bg: string; text: string; icon: typeof CheckCircle2; label: string }> = {
    disponible: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", icon: CheckCircle2, label: "Disponible" },
    "en-ruta": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: MapPin, label: "En Ruta" },
    descanso: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400", icon: Coffee, label: "Descanso" },
  };
  const c = config[estado];
  const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${c.bg} ${c.text}`}><Icon className="w-3 h-3" /> {c.label}</span>;
}

function EstadoVehiculoBadge({ estado }: { estado: EstadoVehiculo }) {
  const config: Record<EstadoVehiculo, { bg: string; text: string; icon: typeof CheckCircle2; label: string }> = {
    disponible: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", icon: CheckCircle2, label: "Disponible" },
    "en-ruta": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: MapPin, label: "En Ruta" },
    mantenimiento: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: AlertTriangle, label: "Mantenimiento" },
  };
  const c = config[estado];
  const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${c.bg} ${c.text}`}><Icon className="w-3 h-3" /> {c.label}</span>;
}

function MarcaBadge({ marca }: { marca: "donofrio" | "jugueton" }) {
  return marca === "donofrio"
    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#1F3C8B]/10 text-[#1F3C8B] dark:bg-[#1F3C8B]/20 dark:text-blue-400">D'Onofrio</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#EF8022]/10 text-[#EF8022] dark:bg-[#EF8022]/20">Juguetón</span>;
}

// ── Main Component ───────────────────────────────────────────────

export function LogisticsPage() {
  const { brand } = useBrand();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"choferes" | "vehiculos" | "asignaciones">("choferes");
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [fichasRutas, setFichasRutas] = useState<FichaResumen[]>([]);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddChofer, setShowAddChofer] = useState(false);
  const [showAddVehiculo, setShowAddVehiculo] = useState(false);
  const [showAddAsignacion, setShowAddAsignacion] = useState(false);

  // Chofer form
  const [choferForm, setChoferForm] = useState({ nombre: "", dni: "", celular: "", licencia: "A-IIb", estado: "disponible" as EstadoChofer });
  // Vehiculo form
  const [vehiculoForm, setVehiculoForm] = useState({ placa: "", modelo: "", marca: "", capacidad: 0, marcasAsignadas: ["donofrio"] as ("donofrio" | "jugueton")[], estado: "disponible" as EstadoVehiculo, ultimoMantenimiento: "", kmActual: 0 });
  // Asignacion form
  const [asignacionForm, setAsignacionForm] = useState({ choferId: 0, vehiculoId: 0, fecha: new Date().toISOString().split("T")[0], ruta: "", entregas: 0, marcaEntregas: [] as ("donofrio" | "jugueton")[], fichasIds: [] as number[] });
  const [fichasSearch, setFichasSearch] = useState("");
  const [fichasSort, setFichasSort] = useState<"fecha" | "hora" | "distrito" | "cliente">("fecha");

  const loadLogisticsData = async () => {
    if (!brand) return;
    setError("");
    try {
      const [choferesApi, vehiculosApi, asignacionesApi, fichasApi] = await Promise.all([
        apiRequest<any[]>("/personal?rol=chofer"),
        apiRequest<any[]>(`/logistics/vehiculos?brand=${brand}`),
        apiRequest<any[]>("/logistics/asignaciones"),
        apiRequest<any[]>(`/fichas?brand=${brand}`),
      ]);

      setFichasRutas(
        fichasApi.map((f) => ({
          id: f.id,
          clienteNombre: f.cliente_nombre || "",
          distrito: f.distrito || "",
          direccion: f.direccion || "",
          fecha: f.fecha,
          horaEntrega: f.hora_entrega || "",
          horaRecojo: f.hora_recojo || "",
          carrito: 1,
        }))
      );

      setChoferes(
        choferesApi.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          dni: c.dni || "",
          celular: c.celular || "",
          licencia: c.licencia || "",
          estado: c.estado,
          rutasCompletadas: c.rutas_completadas || 0,
        }))
      );

      setVehiculos(
        vehiculosApi.map((v) => ({
          id: v.id,
          placa: v.placa,
          modelo: v.modelo || "",
          marca: v.marca || "",
          capacidad: v.capacidad_kg || 0,
          marcasAsignadas: v.marcas_asignadas || [],
          estado: v.estado,
          ultimoMantenimiento: v.ultimo_mantenimiento || "",
          kmActual: v.km_actual || 0,
        }))
      );

      setAsignaciones(
        asignacionesApi.map((a) => {
          const fichasIds: number[] = Array.isArray(a.fichas_ids) ? a.fichas_ids : [];
          const marcaEntregas = Array.from(
            new Set(
              fichasIds
                .map((fid) => fichasApi.find((f) => f.id === fid)?.brand)
                .filter(Boolean)
            )
          ) as ("donofrio" | "jugueton")[];

          return {
            id: a.id,
            choferId: a.chofer_id,
            vehiculoId: a.vehiculo_id,
            fecha: a.fecha,
            ruta: a.ruta || "",
            entregas: a.entregas || fichasIds.length,
            estado: a.estado,
            marcaEntregas,
            fichasIds,
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar logística");
    }
  };

  useEffect(() => {
    loadLogisticsData();
  }, [brand]);

  // Helpers para fichas / carritos
  const getTotalCarritosByIds = (ids: number[]) =>
    ids.reduce((sum, id) => {
      const ficha = fichasRutas.find(f => f.id === id);
      return sum + (ficha?.carrito ?? 0);
    }, 0);

  const toggleFichaEnAsignacion = (fichaId: number) => {
    const ficha = fichasRutas.find(f => f.id === fichaId);
    if (!ficha) return;
    const isSelected = asignacionForm.fichasIds.includes(fichaId);
    if (isSelected) {
      setAsignacionForm(p => ({ ...p, fichasIds: p.fichasIds.filter(id => id !== fichaId) }));
    } else {
      const currentTotal = getTotalCarritosByIds(asignacionForm.fichasIds);
      if (currentTotal + ficha.carrito > MAX_CARRITOS_POR_VEHICULO) return;
      setAsignacionForm(p => ({ ...p, fichasIds: [...p.fichasIds, fichaId] }));
    }
  };

  // Fichas ya asignadas en otras rutas (para la misma fecha)
  const fichasYaAsignadas = asignaciones
    .filter(a => a.fecha === asignacionForm.fecha)
    .flatMap(a => a.fichasIds);

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent text-sm";

  // Stats
  const choferesDisponibles = choferes.filter(c => c.estado === "disponible").length;
  const vehiculosDisponibles = vehiculos.filter(v => v.estado === "disponible").length;
  const today = new Date().toISOString().split("T")[0];
  const asignacionesHoy = asignaciones.filter(a => a.fecha === today).length;
  const rutasCompartidas = asignaciones.filter(a => a.marcaEntregas.length > 1).length;

  const getChoferNombre = (id: number) => choferes.find(c => c.id === id)?.nombre || "—";
  const getVehiculoPlaca = (id: number) => vehiculos.find(v => v.id === id)?.placa || "—";
  const getVehiculoModelo = (id: number) => vehiculos.find(v => v.id === id)?.modelo || "";

  // Filtered lists
  const filteredChoferes = choferes.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.dni.includes(searchTerm)
  );
  const filteredVehiculos = vehiculos.filter(v =>
    v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.marca.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Submit handlers
  const handleAddChofer = async () => {
    if (!choferForm.nombre || !choferForm.dni) return;
    await apiRequest("/personal", {
      method: "POST",
      body: JSON.stringify({
        nombre: choferForm.nombre,
        dni: choferForm.dni,
        celular: choferForm.celular,
        licencia: choferForm.licencia,
        rol: "chofer",
        estado: choferForm.estado,
      }),
    });
    setShowAddChofer(false);
    setChoferForm({ nombre: "", dni: "", celular: "", licencia: "A-IIb", estado: "disponible" });
    await loadLogisticsData();
  };
  const handleAddVehiculo = async () => {
    if (!vehiculoForm.placa || !vehiculoForm.modelo) return;
    await apiRequest("/logistics/vehiculos", {
      method: "POST",
      body: JSON.stringify({
        placa: vehiculoForm.placa,
        modelo: vehiculoForm.modelo,
        marca: vehiculoForm.marca,
        capacidad_kg: vehiculoForm.capacidad,
        marcas_asignadas: vehiculoForm.marcasAsignadas,
        estado: vehiculoForm.estado,
        ultimo_mantenimiento: vehiculoForm.ultimoMantenimiento || null,
        km_actual: vehiculoForm.kmActual || 0,
      }),
    });
    setShowAddVehiculo(false);
    setVehiculoForm({ placa: "", modelo: "", marca: "", capacidad: 0, marcasAsignadas: ["donofrio"], estado: "disponible", ultimoMantenimiento: "", kmActual: 0 });
    await loadLogisticsData();
  };
  const handleAddAsignacion = async () => {
    if (!asignacionForm.choferId || !asignacionForm.vehiculoId) return;
    const totalCarritos = getTotalCarritosByIds(asignacionForm.fichasIds);
    if (totalCarritos > MAX_CARRITOS_POR_VEHICULO) return;
    await apiRequest("/logistics/asignaciones", {
      method: "POST",
      body: JSON.stringify({
        chofer_id: asignacionForm.choferId,
        vehiculo_id: asignacionForm.vehiculoId,
        fecha: asignacionForm.fecha,
        ruta: asignacionForm.ruta,
        entregas: asignacionForm.fichasIds.length || asignacionForm.entregas,
        estado: "programada",
        fichas_ids: asignacionForm.fichasIds,
      }),
    });
    setShowAddAsignacion(false);
    setAsignacionForm({ choferId: 0, vehiculoId: 0, fecha: new Date().toISOString().split("T")[0], ruta: "", entregas: 0, marcaEntregas: [], fichasIds: [] });
    setFichasSearch("");
    setFichasSort("fecha");
    await loadLogisticsData();
  };

  const handleDeleteChofer = async (id: number) => {
    await apiRequest(`/personal/${id}`, { method: "DELETE" });
    await loadLogisticsData();
  };
  const handleDeleteVehiculo = async (id: number) => {
    await apiRequest(`/logistics/vehiculos/${id}`, { method: "DELETE" });
    await loadLogisticsData();
  };

  const tabs = [
    { key: "choferes" as const, label: "Choferes", icon: User, count: choferes.length },
    { key: "vehiculos" as const, label: "Vehículos", icon: Truck, count: vehiculos.length },
    { key: "asignaciones" as const, label: "Asignaciones", icon: ChevronRight, count: asignaciones.length },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Logística y Recursos</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestiona choferes, vehículos y asignaciones de rutas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><User className="w-4 h-4 text-green-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Choferes Disponibles</span></div>
          <p className="text-2xl text-green-600 dark:text-green-400">{choferesDisponibles}<span className="text-sm text-gray-400">/{choferes.length}</span></p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><Truck className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-xs text-gray-500 dark:text-gray-400">Vehículos Disponibles</span></div>
          <p className="text-2xl text-[#1F3C8B] dark:text-blue-400">{vehiculosDisponibles}<span className="text-sm text-gray-400">/{vehiculos.length}</span></p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-[#EF8022]" /><span className="text-xs text-gray-500 dark:text-gray-400">Asignaciones Hoy</span></div>
          <p className="text-2xl text-[#EF8022]">{asignacionesHoy}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-purple-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Rutas Compartidas</span></div>
          <p className="text-2xl text-purple-600 dark:text-purple-400">{rutasCompartidas}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Multi-marca en un vehículo</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearchTerm(""); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm transition-colors ${activeTab === tab.key ? "bg-[#EF8022]/10 text-[#EF8022] border-b-2 border-[#EF8022]" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}>
                <Icon className="w-4 h-4" /> {tab.label}
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.key ? "bg-[#EF8022]/20 text-[#EF8022]" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Search + Add row */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder={activeTab === "choferes" ? "Buscar por nombre o DNI..." : activeTab === "vehiculos" ? "Buscar por placa o modelo..." : "Buscar asignación..."}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] text-sm" />
          </div>
          <button onClick={() => {
            if (activeTab === "choferes") setShowAddChofer(true);
            else if (activeTab === "vehiculos") setShowAddVehiculo(true);
            else setShowAddAsignacion(true);
          }}
            className="bg-[#EF8022] text-white px-5 py-2.5 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> {activeTab === "choferes" ? "Nuevo Chofer" : activeTab === "vehiculos" ? "Nuevo Vehículo" : "Nueva Asignación"}
          </button>
        </div>

        {/* ── CHOFERES TAB ──────────────────────────────────── */}
        {activeTab === "choferes" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Chofer</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">DNI</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Celular</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Licencia</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estado</th>
                  <th className="text-center px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rutas</th>
                  <th className="text-right px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredChoferes.map(chofer => (
                  <tr key={chofer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1F3C8B] to-[#EF8022] flex items-center justify-center text-white text-sm">{chofer.nombre.charAt(0)}</div>
                        <span className="text-sm text-gray-900 dark:text-white">{chofer.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">{chofer.dni}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chofer.celular}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chofer.licencia}</td>
                    <td className="px-6 py-4"><EstadoChoferBadge estado={chofer.estado} /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-white">{chofer.rutasCompletadas}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-2 text-gray-400 hover:text-[#EF8022] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteChofer(chofer.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredChoferes.length === 0 && (
              <div className="text-center py-12"><User className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-400 dark:text-gray-500 text-sm">No se encontraron choferes</p></div>
            )}
          </div>
        )}

        {/* ── VEHICULOS TAB ─────────────────────────────────── */}
        {activeTab === "vehiculos" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vehículo</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Placa</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cap. (kg)</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Marcas</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Último Mant.</th>
                  <th className="text-right px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Km</th>
                  <th className="text-right px-6 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredVehiculos.map(vehiculo => (
                  <tr key={vehiculo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Truck className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" /></div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">{vehiculo.modelo}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{vehiculo.marca}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-900 dark:text-white">{vehiculo.placa}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vehiculo.capacidad.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">{vehiculo.marcasAsignadas.map(m => <MarcaBadge key={m} marca={m} />)}</div>
                    </td>
                    <td className="px-6 py-4"><EstadoVehiculoBadge estado={vehiculo.estado} /></td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vehiculo.ultimoMantenimiento}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400 font-mono">{vehiculo.kmActual.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-2 text-gray-400 hover:text-[#EF8022] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteVehiculo(vehiculo.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredVehiculos.length === 0 && (
              <div className="text-center py-12"><Truck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-400 dark:text-gray-500 text-sm">No se encontraron vehículos</p></div>
            )}
          </div>
        )}

        {/* ── ASIGNACIONES TAB ──────────────────────────────── */}
        {activeTab === "asignaciones" && (
          <div className="p-4 space-y-3">
            {/* Info banner about shared routes */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-start gap-2 mb-4">
              <Shield className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
              <p className="text-xs text-purple-700 dark:text-purple-400">
                <strong>Rutas compartidas:</strong> Un mismo vehículo puede transportar pedidos de D'Onofrio y Juguetón en la misma ruta, optimizando recursos especialmente en temporada baja.
              </p>
            </div>

            {asignaciones.map(asig => {
              const estadoConfig = {
                programada: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Programada" },
                "en-curso": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", label: "En Curso" },
                completada: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Completada" },
              };
              const e = estadoConfig[asig.estado];
              const enCurso = asig.estado === "en-curso";
              const handleVerEnMapa = () => {
                const vehiculo = vehiculos.find(v => v.id === asig.vehiculoId);
                navigate("/dashboard/rutas", {
                  state: {
                    vehiculoPlaca: vehiculo?.placa,
                    asignacionId: asig.id,
                    ruta: asig.ruta,
                  },
                });
              };
              return (
                <div key={asig.id}
                  onClick={enCurso ? handleVerEnMapa : undefined}
                  className={`bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-shadow ${
                    enCurso
                      ? "cursor-pointer hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-gray-700"
                      : "hover:shadow-md"
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{asig.ruta}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{asig.fecha}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${e.bg} ${e.text}`}>{e.label}</span>
                      {enCurso && (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-500 text-white">
                          <Map className="w-3 h-3" /> Ver en mapa
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase">Chofer</p>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-white">{getChoferNombre(asig.choferId)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase">Vehículo</p>
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-white font-mono">{getVehiculoPlaca(asig.vehiculoId)}</span>
                        <span className="text-xs text-gray-400">{getVehiculoModelo(asig.vehiculoId)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase">Fichas / Carritos</p>
                      <span className="text-sm text-gray-900 dark:text-white">{asig.fichasIds.length} fichas · {getTotalCarritosByIds(asig.fichasIds)}/{MAX_CARRITOS_POR_VEHICULO} carritos</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase">Marcas</p>
                      <div className="flex gap-1">{asig.marcaEntregas.map(m => <MarcaBadge key={m} marca={m} />)}</div>
                    </div>
                  </div>

                  {/* Fichas con dirección de entrega */}
                  {asig.fichasIds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 uppercase flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Direcciones de entrega
                      </p>
                      <div className="space-y-1.5">
                        {asig.fichasIds.map(id => {
                          const ficha = fichasRutas.find(f => f.id === id);
                          if (!ficha) return null;
                          return (
                            <div key={id} className="flex items-start gap-2 text-xs">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-[#EF8022]/10 text-[#EF8022] flex items-center justify-center text-[9px]">{ficha.carrito}</span>
                              <div className="min-w-0">
                                <span className="text-gray-900 dark:text-white">{ficha.clienteNombre}</span>
                                <span className="text-gray-400 mx-1">·</span>
                                <span className="text-gray-500 dark:text-gray-400">{ficha.direccion}, {ficha.distrito}</span>
                                <span className="text-gray-400 dark:text-gray-500 ml-2">({ficha.horaEntrega})</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {asignaciones.length === 0 && (
              <div className="text-center py-12"><MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm">No hay asignaciones</p></div>
            )}
          </div>
        )}
      </div>

      {/* ── ADD CHOFER MODAL ────────────────────────────────── */}
      {showAddChofer && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAddChofer(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-2"><User className="w-5 h-5 text-[#EF8022]" /> Nuevo Chofer</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Nombre Completo *</label>
                  <input type="text" value={choferForm.nombre} onChange={e => setChoferForm(p => ({ ...p, nombre: e.target.value }))} className={inputClass} placeholder="Ej: Carlos Mendoza" /></div>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">DNI *</label>
                  <input type="text" value={choferForm.dni} onChange={e => setChoferForm(p => ({ ...p, dni: e.target.value }))} maxLength={8} className={inputClass} placeholder="Ej: 45678923" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Celular</label>
                  <input type="tel" value={choferForm.celular} onChange={e => setChoferForm(p => ({ ...p, celular: e.target.value }))} className={inputClass} placeholder="Ej: 987 654 321" /></div>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Categoría Licencia</label>
                  <select value={choferForm.licencia} onChange={e => setChoferForm(p => ({ ...p, licencia: e.target.value }))} className={inputClass}>
                    <option value="A-IIb">A-IIb (Camioneta)</option>
                    <option value="A-IIIa">A-IIIa (Camión liviano)</option>
                    <option value="A-IIIb">A-IIIb (Camión pesado)</option>
                  </select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddChofer(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
                <button onClick={handleAddChofer} disabled={!choferForm.nombre || !choferForm.dni} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] text-sm disabled:opacity-50">Guardar Chofer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD VEHICULO MODAL ──────────────────────────────── */}
      {showAddVehiculo && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAddVehiculo(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-2"><Truck className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" /> Nuevo Vehículo</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Placa *</label>
                  <input type="text" value={vehiculoForm.placa} onChange={e => setVehiculoForm(p => ({ ...p, placa: e.target.value.toUpperCase() }))} className={`${inputClass} font-mono uppercase`} placeholder="Ej: ABC-123" /></div>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Marca del Vehículo *</label>
                  <input type="text" value={vehiculoForm.marca} onChange={e => setVehiculoForm(p => ({ ...p, marca: e.target.value }))} className={inputClass} placeholder="Ej: Toyota" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Modelo *</label>
                  <input type="text" value={vehiculoForm.modelo} onChange={e => setVehiculoForm(p => ({ ...p, modelo: e.target.value }))} className={inputClass} placeholder="Ej: Hilux 2023" /></div>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Capacidad (kg)</label>
                  <input type="number" value={vehiculoForm.capacidad || ""} onChange={e => setVehiculoForm(p => ({ ...p, capacidad: Number(e.target.value) }))} className={inputClass} placeholder="1200" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Km Actual</label>
                  <input type="number" value={vehiculoForm.kmActual || ""} onChange={e => setVehiculoForm(p => ({ ...p, kmActual: Number(e.target.value) }))} className={inputClass} placeholder="45000" /></div>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Último Mantenimiento</label>
                  <input type="date" value={vehiculoForm.ultimoMantenimiento} onChange={e => setVehiculoForm(p => ({ ...p, ultimoMantenimiento: e.target.value }))} className={inputClass} /></div>
              </div>
              {/* Brands assignment */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Marcas Asignadas</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={vehiculoForm.marcasAsignadas.includes("donofrio")}
                      onChange={e => {
                        setVehiculoForm(p => ({
                          ...p,
                          marcasAsignadas: e.target.checked ? [...p.marcasAsignadas, "donofrio"] : p.marcasAsignadas.filter(m => m !== "donofrio")
                        }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-[#1F3C8B] focus:ring-[#1F3C8B]" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">D'Onofrio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={vehiculoForm.marcasAsignadas.includes("jugueton")}
                      onChange={e => {
                        setVehiculoForm(p => ({
                          ...p,
                          marcasAsignadas: e.target.checked ? [...p.marcasAsignadas, "jugueton"] : p.marcasAsignadas.filter(m => m !== "jugueton")
                        }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-[#EF8022] focus:ring-[#EF8022]" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Juguetón</span>
                  </label>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Los vehículos pueden asignarse a ambas marcas para compartir rutas</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddVehiculo(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
                <button onClick={handleAddVehiculo} disabled={!vehiculoForm.placa || !vehiculoForm.modelo} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] text-sm disabled:opacity-50">Guardar Vehículo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD ASIGNACION MODAL ────────────────────────────── */}
      {showAddAsignacion && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAddAsignacion(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-2"><ChevronRight className="w-5 h-5 text-[#EF8022]" /> Nueva Asignación de Ruta</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Chofer *</label>
                  <select value={asignacionForm.choferId} onChange={e => setAsignacionForm(p => ({ ...p, choferId: Number(e.target.value) }))} className={inputClass}>
                    <option value={0}>Seleccionar chofer...</option>
                    {choferes.filter(c => c.estado === "disponible").map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select></div>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Vehículo *</label>
                  <select value={asignacionForm.vehiculoId} onChange={e => setAsignacionForm(p => ({ ...p, vehiculoId: Number(e.target.value) }))} className={inputClass}>
                    <option value={0}>Seleccionar vehículo...</option>
                    {vehiculos.filter(v => v.estado === "disponible").map(v => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Fecha *</label>
                  <input type="date" value={asignacionForm.fecha} onChange={e => setAsignacionForm(p => ({ ...p, fecha: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">N.º de Entregas</label>
                  <input type="number" value={asignacionForm.entregas || ""} onChange={e => setAsignacionForm(p => ({ ...p, entregas: Number(e.target.value) }))} className={inputClass} min={0} /></div>
              </div>
              <div><label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Nombre de Ruta</label>
                <input type="text" value={asignacionForm.ruta} onChange={e => setAsignacionForm(p => ({ ...p, ruta: e.target.value }))} className={inputClass} placeholder="Ej: Zona Sur - Surco/Miraflores" /></div>

              {/* ── Selector de Fichas ─────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-gray-600 dark:text-gray-400">Fichas de entrega</label>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    getTotalCarritosByIds(asignacionForm.fichasIds) >= MAX_CARRITOS_POR_VEHICULO
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : "bg-[#EF8022]/10 text-[#EF8022]"
                  }`}>
                    {getTotalCarritosByIds(asignacionForm.fichasIds)}/{MAX_CARRITOS_POR_VEHICULO} carritos
                  </span>
                </div>

                {/* Búsqueda + Orden */}
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={fichasSearch}
                      onChange={e => setFichasSearch(e.target.value)}
                      placeholder="Buscar cliente, distrito..."
                      className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                    />
                  </div>
                  <select
                    value={fichasSort}
                    onChange={e => setFichasSort(e.target.value as typeof fichasSort)}
                    className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="fecha">Fecha</option>
                    <option value="hora">Hora entrega</option>
                    <option value="distrito">Distrito</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                  {[...fichasRutas]
                    .filter(f =>
                      fichasSearch === "" ||
                      f.clienteNombre.toLowerCase().includes(fichasSearch.toLowerCase()) ||
                      f.distrito.toLowerCase().includes(fichasSearch.toLowerCase()) ||
                      f.direccion.toLowerCase().includes(fichasSearch.toLowerCase())
                    )
                    .sort((a, b) => {
                      if (fichasSort === "fecha") return a.fecha.localeCompare(b.fecha);
                      if (fichasSort === "hora") return a.horaEntrega.localeCompare(b.horaEntrega);
                      if (fichasSort === "distrito") return a.distrito.localeCompare(b.distrito);
                      return a.clienteNombre.localeCompare(b.clienteNombre);
                    })
                    .map(ficha => {
                    const isSelected = asignacionForm.fichasIds.includes(ficha.id);
                    const totalActual = getTotalCarritosByIds(asignacionForm.fichasIds);
                    const wouldExceed = !isSelected && (totalActual + ficha.carrito > MAX_CARRITOS_POR_VEHICULO);
                    const yaAsignada = fichasYaAsignadas.includes(ficha.id);
                    return (
                      <label key={ficha.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                        yaAsignada
                          ? "border-gray-200 dark:border-gray-600 opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-700/30"
                          : isSelected
                          ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10"
                          : wouldExceed
                          ? "border-gray-200 dark:border-gray-600 opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-700/30"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-700/30"
                      }`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={wouldExceed || yaAsignada}
                          onChange={() => toggleFichaEnAsignacion(ficha.id)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#EF8022] focus:ring-[#EF8022] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-gray-900 dark:text-white truncate">{ficha.clienteNombre}</p>
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                              {ficha.carrito} {ficha.carrito === 1 ? "carrito" : "carritos"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" /> {ficha.direccion}, {ficha.distrito}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {ficha.fecha} · Entrega {ficha.horaEntrega} – Recojo {ficha.horaRecojo}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                  {fichasSearch !== "" && fichasRutas.every(f =>
                    !f.clienteNombre.toLowerCase().includes(fichasSearch.toLowerCase()) &&
                    !f.distrito.toLowerCase().includes(fichasSearch.toLowerCase()) &&
                    !f.direccion.toLowerCase().includes(fichasSearch.toLowerCase())
                  ) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">Sin resultados para "{fichasSearch}"</p>
                  )}
                </div>
                {getTotalCarritosByIds(asignacionForm.fichasIds) >= MAX_CARRITOS_POR_VEHICULO && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Límite de {MAX_CARRITOS_POR_VEHICULO} carritos por vehículo alcanzado
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Marcas en esta ruta</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={asignacionForm.marcaEntregas.includes("donofrio")}
                      onChange={e => setAsignacionForm(p => ({ ...p, marcaEntregas: e.target.checked ? [...p.marcaEntregas, "donofrio"] : p.marcaEntregas.filter(m => m !== "donofrio") }))}
                      className="w-4 h-4 rounded border-gray-300 text-[#1F3C8B] focus:ring-[#1F3C8B]" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">D'Onofrio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={asignacionForm.marcaEntregas.includes("jugueton")}
                      onChange={e => setAsignacionForm(p => ({ ...p, marcaEntregas: e.target.checked ? [...p.marcaEntregas, "jugueton"] : p.marcaEntregas.filter(m => m !== "jugueton") }))}
                      className="w-4 h-4 rounded border-gray-300 text-[#EF8022] focus:ring-[#EF8022]" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Juguetón</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddAsignacion(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
                <button onClick={handleAddAsignacion} disabled={!asignacionForm.choferId || !asignacionForm.vehiculoId || asignacionForm.fichasIds.length === 0} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] text-sm disabled:opacity-50">Crear Asignación</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}