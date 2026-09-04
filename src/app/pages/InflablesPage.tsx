import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Wind,
  CheckCircle,
  AlertCircle,
  Eye,
  Trash2,
  Wrench,
  AlertTriangle,
  ShoppingCart,
  Bell,
  Clock,
  CheckCircle2,
  Upload,
  Pencil,
} from "lucide-react";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { useBrand } from "../contexts/BrandContext";
import { apiRequest, API_BASE_URL } from "../lib/api";
import { canManageResources } from "../lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────

interface InflableType {
  id: number;
  nombre: string;
  descripcion: string;
  cantidadUnidades: number;
  precioAlquiler: number;
  dimensiones: string;
  edadMinima: string;
  imagen: string;
}

interface Reserva {
  id: number;
  inflableId: number;
  clienteNombre: string;
  fecha: string;
  cantidad: number;
  evento: string;
  notas: string;
}

type CarritoModelo = string;

interface Carrito {
  id: number;       // tipo_id
  unitIds: number[]; // IDs de las unidades físicas de este tipo
  modelo: CarritoModelo;
  codigo: string;
  descripcion: string;
  cantidadTotal: number;
  precioAlquiler: number;
  imagen: string;
}

interface ReservaCarrito {
  id: number;
  carritoId: number;  // tipo_id del grupo
  unitId: number;     // id de la unidad física real (para DELETE)
  clienteNombre: string;
  fecha: string;
  cantidad: number;
  evento: string;
  notas: string;
}

type SeveridadAlerta = "critica" | "advertencia" | "info";
type EstadoAlerta = "pendiente" | "en-proceso" | "resuelta";
type TipoRecurso = "inflable" | "carrito";

interface FichaCalendario {
  id: number;
  titulo: string;
  clienteNombre: string;
  clienteCelular: string;
  fecha: string;
  horaEntrega: string;
  tipoEvento: string;
  distrito: string;
}

interface AlertaMantenimiento {
  id: number;
  recursoTipo: TipoRecurso;
  recursoId: number;
  recursoNombre: string;
  severidad: SeveridadAlerta;
  estado: EstadoAlerta;
  titulo: string;
  descripcion: string;
  reportadoPor: string;
  fechaReporte: string;
  fechaResolucion?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const EMOJI_MAP: Record<string, string> = {
  castle: "🏰", slide: "🌊", bounce: "🤸", obstacle: "🏃",
  foosball: "⚽", mini: "🎪", combo: "🎢",
};

const CARRITO_EMOJI: Record<string, string> = {
  blanco: "🤍", clasico: "🛒", delgado: "📦", nuevo: "✨",
  BLANCO: "🤍", CLASICO: "🛒", DELGADO: "📦", NUEVO: "✨",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAY_HEADERS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ── Severity / Status helpers ──────────────────────────────────────────────

function SeveridadBadge({ severidad }: { severidad: SeveridadAlerta }) {
  const cfg: Record<SeveridadAlerta, { bg: string; text: string; label: string }> = {
    critica: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Crítica" },
    advertencia: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Advertencia" },
    info: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", label: "Info" },
  };
  const c = cfg[severidad];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${c.bg} ${c.text}`}>{severidad === "critica" ? <AlertCircle className="w-3 h-3" /> : severidad === "advertencia" ? <AlertTriangle className="w-3 h-3" /> : <Bell className="w-3 h-3" />} {c.label}</span>;
}

function EstadoAlertaBadge({ estado }: { estado: EstadoAlerta }) {
  const cfg: Record<EstadoAlerta, { bg: string; text: string; icon: typeof Clock; label: string }> = {
    pendiente: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", icon: Clock, label: "Pendiente" },
    "en-proceso": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Wrench, label: "En Proceso" },
    resuelta: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", icon: CheckCircle2, label: "Resuelta" },
  };
  const c = cfg[estado];
  const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${c.bg} ${c.text}`}><Icon className="w-3 h-3" /> {c.label}</span>;
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

// ── Component ──────────────────────────────────────────────────────────────

export function InflablesPage() {
  const canManage = canManageResources();
  const { brand } = useBrand();
  // State
  const [inflables, setInflables] = useState<InflableType[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carritos, setCarritos] = useState<Carrito[]>([]);
  const [reservasCarritos, setReservasCarritos] = useState<ReservaCarrito[]>([]);
  const [alertas, setAlertas] = useState<AlertaMantenimiento[]>([]);
  const [fichasCalendario, setFichasCalendario] = useState<FichaCalendario[]>([]);
  const [selectedFichaCal, setSelectedFichaCal] = useState<FichaCalendario | null>(null);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<InflableType | null>(null);
  const [selectedCarrito, setSelectedCarrito] = useState<Carrito | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showNewReserva, setShowNewReserva] = useState(false);
  const [showNewInflable, setShowNewInflable] = useState(false);
  const [showNewAlerta, setShowNewAlerta] = useState(false);
  const [showNewReservaCarrito, setShowNewReservaCarrito] = useState(false);
  const [mainTab, setMainTab] = useState<"inflables" | "carritos" | "mantenimiento" | "calendario">("inflables");
  const [reservaSubmitting, setReservaSubmitting] = useState(false);
  const [reservaCarritoSubmitting, setReservaCarritoSubmitting] = useState(false);
  const [inflableSubmitting, setInflableSubmitting] = useState(false);
  const [isCleaningImagen, setIsCleaningImagen] = useState(false);
  const [alertaSubmitting, setAlertaSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "reserva"; id: number; label: string }
    | { kind: "reservaCarrito"; id: number; label: string }
    | { kind: "inflable"; id: number; label: string }
    | null
  >(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const submitLocksRef = useRef({ reserva: false, reservaCarrito: false, inflable: false, alerta: false, unidad: false });

  // Forms
  const [newReserva, setNewReserva] = useState({ inflableId: 0, clienteNombre: "", fecha: "", cantidad: 1, evento: "", notas: "" });
  const [newInflable, setNewInflable] = useState({ nombre: "", descripcion: "", precioAlquiler: 0, dimensiones: "", edadMinima: "" });
  const [showNewUnidad, setShowNewUnidad] = useState(false);
  const [newUnidad, setNewUnidad] = useState({ tipoId: 0, codigo: "", estado: "disponible" as "disponible" | "en-uso" | "mantenimiento", fechaAdquisicion: "" });
  const [unidadSubmitting, setUnidadSubmitting] = useState(false);
  const [inflableImagen, setInflableImagen] = useState({ url: "", path: "", name: "" });
  const [isUploadingImagen, setIsUploadingImagen] = useState(false);
  const [uploadImagenError, setUploadImagenError] = useState("");
  const [showEditInflable, setShowEditInflable] = useState(false);
  const [editInflableData, setEditInflableData] = useState<InflableType | null>(null);
  const [editInflableForm, setEditInflableForm] = useState({ nombre: "", descripcion: "", precioAlquiler: 0, dimensiones: "", edadMinima: "" });
  const [editInflableImagen, setEditInflableImagen] = useState({ url: "", path: "", name: "" });
  const [isUploadingEditImagen, setIsUploadingEditImagen] = useState(false);
  const [isCleaningEditImagen, setIsCleaningEditImagen] = useState(false);
  const [uploadEditImagenError, setUploadEditImagenError] = useState("");
  const [editInflableSubmitting, setEditInflableSubmitting] = useState(false);
  const [newAlerta, setNewAlerta] = useState<{ recursoTipo: TipoRecurso; recursoId: number; severidad: SeveridadAlerta; titulo: string; descripcion: string; reportadoPor: string }>({
    recursoTipo: "inflable", recursoId: 0, severidad: "advertencia", titulo: "", descripcion: "", reportadoPor: "",
  });
  const [newResCarrito, setNewResCarrito] = useState({ carritoId: 0, clienteNombre: "", fecha: "", cantidad: 1, evento: "", notas: "" });
  const [alertaFilter, setAlertaFilter] = useState<"all" | "pendiente" | "en-proceso" | "resuelta">("all");

  const inputClass = "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]";

  // ── Derived ────────────────────────────────────────────────────────────

  const todayStr = new Date().toISOString().split("T")[0];

  const loadData = async () => {
    if (!brand) return;
    setError("");
    try {
      const [inflablesTiposApi, carritosApi, maintenanceApi, fichasListApi, inflablesUnitsApi] = await Promise.all([
        apiRequest<any[]>("/inflables/tipos"),
        apiRequest<any[]>("/carritos"),
        apiRequest<any[]>("/maintenance"),
        apiRequest<any[]>(`/fichas?brand=${brand}`),
        apiRequest<any[]>("/inflables"),
      ]);

      // El listado de /fichas no incluye inflableIds/carritoIds; se obtiene el detalle de cada ficha
      const fichasApi = (await Promise.all(
        fichasListApi.map((item) => apiRequest<any>(`/fichas/${item.id}`).catch(() => null))
      )).filter((f): f is any => f !== null);

      const inflablesMapped: InflableType[] = inflablesTiposApi.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        descripcion: i.descripcion || "",
        cantidadUnidades: i.cantidad_unidades || 0,
        precioAlquiler: Number(i.precio_alquiler || 0),
        dimensiones: i.dimensiones || "",
        edadMinima: i.edad_minima || "",
        imagen: i.imagen_url || "generic",
      }));

      // Mapping unitId -> tipoId
      const inflableUnitToTipo = new Map<number, number>();
      inflablesUnitsApi.forEach((u: any) => { if (u.tipo_id) inflableUnitToTipo.set(u.id, u.tipo_id); });
      
      const carritoUnitToTipo = new Map<number, number>();
      carritosApi.forEach((c: any) => { 
        const tId = c.tipo_id ?? c.id;
        if (tId) carritoUnitToTipo.set(c.id, tId); 
      });

      // Agrupar unidades físicas por tipo_id para mostrar stock por tipo
      const tipoGroups = new Map<number, any[]>();
      carritosApi.forEach((c: any) => {
        const key: number = c.tipo_id ?? c.id;
        if (!tipoGroups.has(key)) tipoGroups.set(key, []);
        tipoGroups.get(key)!.push(c);
      });

      const carritosMapped: Carrito[] = Array.from(tipoGroups.entries()).map(([tipoId, units]) => ({
        id: tipoId,
        unitIds: units.map((u: any) => u.id),
        modelo: (units[0].tipo_nombre || units[0].modelo || "Sin tipo") as CarritoModelo,
        codigo: units.map((u: any) => u.codigo).join(", "),
        descripcion: units[0].descripcion || "",
        cantidadTotal: units.length,
        precioAlquiler: Number(units[0].precio_alquiler || 0),
        imagen: units[0].imagen_url || (units[0].tipo_nombre || units[0].modelo || "").toLowerCase(),
      }));

      const [reservasInflablesChunks, reservasCarritosChunks] = await Promise.all([
        Promise.all(inflablesMapped.map((i) => apiRequest<any[]>(`/inflables/tipos/${i.id}/reservas`).catch(() => []))),
        Promise.all(carritosApi.map((c: any) => apiRequest<any[]>(`/carritos/${c.id}/reservas`).catch(() => []))),
      ]);

      // Reservas manuales de inflables
      const manualReservasInflables: Reserva[] = reservasInflablesChunks.flatMap((chunk) =>
        chunk.map((r) => ({
          id: r.id,
          inflableId: r.inflable_id,
          clienteNombre: r.cliente_nombre || "",
          fecha: r.fecha,
          cantidad: r.cantidad || 0,
          evento: r.evento || "",
          notas: r.notas || "",
        }))
      );

      // Reservas provenientes de Fichas (inflables)
      const fichaReservasInflables: Reserva[] = fichasApi.flatMap((f) => {
        const fecha = (f.fecha_evento || f.fecha || "").split("T")[0];
        if (!fecha || !f.inflableIds || f.inflableIds.length === 0) return [];
        return f.inflableIds.map((unitId: number, idx: number) => {
          const tipoId = inflableUnitToTipo.get(unitId);
          if (!tipoId) return null;
          return {
            id: -(f.id * 1000 + idx + 1), // ID único negativo
            inflableId: tipoId,
            clienteNombre: f.cliente_nombre || "Ficha #" + f.id,
            fecha,
            cantidad: 1,
            evento: f.distrito || "Evento Ficha",
            notas: "Ficha #" + f.id + (f.created_by_nombre ? ` (${f.created_by_nombre})` : ""),
          };
        }).filter(Boolean);
      });

      // Reservas manuales de carritos
      const manualReservasCarritos: ReservaCarrito[] = reservasCarritosChunks.flatMap((chunk, i) => {
        const unitId: number = carritosApi[i].id;
        const tipoId: number = carritoUnitToTipo.get(unitId) ?? unitId;
        return chunk.map((r: any) => ({
          id: r.id,
          carritoId: tipoId,
          unitId,
          clienteNombre: r.cliente_nombre || "",
          fecha: r.fecha,
          cantidad: r.cantidad || 0,
          evento: r.evento || "",
          notas: r.notas || "",
        }));
      });

      // Reservas provenientes de Fichas (carritos)
      const fichaReservasCarritos: ReservaCarrito[] = fichasApi.flatMap((f) => {
        const fecha = (f.fecha_evento || f.fecha || "").split("T")[0];
        if (!fecha || !f.carritoIds || f.carritoIds.length === 0) return [];
        return f.carritoIds.map((unitId: number, idx: number) => {
          const tipoId = carritoUnitToTipo.get(unitId);
          if (!tipoId) return null;
          return {
            id: -(f.id * 1000 + idx + 500), // ID único negativo diferente rango
            carritoId: tipoId,
            unitId: unitId,
            clienteNombre: f.cliente_nombre || "Ficha #" + f.id,
            fecha,
            cantidad: 1,
            evento: f.distrito || "Evento Ficha",
            notas: "Ficha #" + f.id + (f.created_by_nombre ? ` (${f.created_by_nombre})` : ""),
          };
        }).filter(Boolean);
      });

      const alertasMapped: AlertaMantenimiento[] = maintenanceApi.map((a) => ({
        id: a.id,
        recursoTipo: a.recurso_tipo,
        recursoId: a.recurso_id,
        recursoNombre: a.recurso_nombre || "",
        severidad: a.severidad,
        estado: a.estado,
        titulo: a.titulo || "",
        descripcion: a.descripcion || "",
        reportadoPor: a.reportado_por || "Sistema",
        fechaReporte: a.fecha_reporte || "",
        fechaResolucion: a.fecha_resolucion || undefined,
      }));

      const fichasCalendarioMapped: FichaCalendario[] = fichasApi.map((f) => ({
        id: f.id,
        titulo: f.titulo || "",
        clienteNombre: f.cliente_nombre || "",
        clienteCelular: f.cliente_celular || "",
        fecha: (f.fecha_evento || f.fecha || "").split("T")[0],
        horaEntrega: f.hora_entrega || "",
        tipoEvento: f.tipo_evento || "",
        distrito: f.distrito || "",
      })).filter((f) => f.fecha);

      setInflables(inflablesMapped);
      setCarritos(carritosMapped);
      setReservas([...manualReservasInflables, ...fichaReservasInflables]);
      setReservasCarritos([...manualReservasCarritos, ...fichaReservasCarritos]);
      setAlertas(alertasMapped);
      setFichasCalendario(fichasCalendarioMapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar inflables y carritos");
    }
  };

  useEffect(() => {
    loadData();
  }, [brand]);

  const filteredInflables = inflables.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || i.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCarritos = carritos.filter(c => c.modelo.toLowerCase().includes(searchTerm.toLowerCase()) || c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));

  const getReservedCount = (inflableId: number, date: string) =>
    reservas.filter(r => r.inflableId === inflableId && r.fecha === date).reduce((s, r) => s + r.cantidad, 0);
  const getCarritoReservedCount = (carritoId: number, date: string) =>
    reservasCarritos.filter(r => r.carritoId === carritoId && r.fecha === date).reduce((s, r) => s + r.cantidad, 0);
  const getReservasByDate = (date: string) => reservas.filter(r => r.fecha === date);
  const getReservasCarritoByDate = (date: string) => reservasCarritos.filter(r => r.fecha === date);
  const getFichasByDate = (date: string) => fichasCalendario.filter(f => f.fecha === date);

  const filteredFichasCalendario = [...fichasCalendario]
    .filter(f =>
      f.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.distrito.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const calendarFichasMap = useMemo(() => {
    const map: Record<string, number> = {};
    const days = getDaysInMonth(calendarYear, calendarMonth);
    for (let d = 1; d <= days; d++) {
      const dateStr = formatDate(new Date(calendarYear, calendarMonth, d));
      map[dateStr] = getFichasByDate(dateStr).length;
    }
    return map;
  }, [fichasCalendario, calendarYear, calendarMonth]);

  // Active alerts per resource
  const getActiveAlerts = (tipo: TipoRecurso, id: number) =>
    alertas.filter(a => a.recursoTipo === tipo && a.recursoId === id && a.estado !== "resuelta");
  const getMaxSeverity = (tipo: TipoRecurso, id: number): SeveridadAlerta | null => {
    const active = getActiveAlerts(tipo, id);
    if (active.some(a => a.severidad === "critica")) return "critica";
    if (active.some(a => a.severidad === "advertencia")) return "advertencia";
    if (active.some(a => a.severidad === "info")) return "info";
    return null;
  };

  // Calendar
  const calendarReservationMap = useMemo(() => {
    const map: Record<string, number> = {};
    const days = getDaysInMonth(calendarYear, calendarMonth);
    for (let d = 1; d <= days; d++) {
      const dateStr = formatDate(new Date(calendarYear, calendarMonth, d));
      if (mainTab === "inflables") {
        if (selectedType) map[dateStr] = getReservedCount(selectedType.id, dateStr);
        else map[dateStr] = getReservasByDate(dateStr).reduce((s, r) => s + r.cantidad, 0);
      } else {
        if (selectedCarrito) map[dateStr] = getCarritoReservedCount(selectedCarrito.id, dateStr);
        else map[dateStr] = getReservasCarritoByDate(dateStr).reduce((s, r) => s + r.cantidad, 0);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservas, reservasCarritos, calendarYear, calendarMonth, selectedType, selectedCarrito, mainTab]);

  // Stats
  const totalInflables = inflables.reduce((s, i) => s + i.cantidadUnidades, 0);
  const reservadosInflablesHoy = inflables.reduce((s, i) => s + getReservedCount(i.id, todayStr), 0);
  const totalCarritos = carritos.length;
  const reservadosCarritosHoy = carritos.reduce((s, c) => s + getCarritoReservedCount(c.id, todayStr), 0);
  const alertasPendientes = alertas.filter(a => a.estado === "pendiente").length;
  const alertasCriticas = alertas.filter(a => a.severidad === "critica" && a.estado !== "resuelta").length;

  // Max capacity for calendar
  const calendarMaxCap = mainTab === "inflables"
    ? (selectedType ? selectedType.cantidadUnidades : totalInflables)
    : totalCarritos;

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleAddReserva = async () => {
    if (!newReserva.inflableId || !newReserva.clienteNombre || !newReserva.fecha || !newReserva.cantidad) return;
    if (submitLocksRef.current.reserva || reservaSubmitting) return;
    const inflable = inflables.find(i => i.id === newReserva.inflableId);
    if (!inflable) return;
    const reserved = getReservedCount(newReserva.inflableId, newReserva.fecha);
    if (reserved + newReserva.cantidad > inflable.cantidadUnidades) {
      alert(`Solo hay ${inflable.cantidadUnidades - reserved} unidad(es) disponible(s) de "${inflable.nombre}" para esa fecha.`);
      return;
    }
    submitLocksRef.current.reserva = true;
    setReservaSubmitting(true);
    try {
      await apiRequest(`/inflables/${newReserva.inflableId}/reservas`, {
        method: "POST",
        body: JSON.stringify({
          cliente_nombre: newReserva.clienteNombre,
          fecha: newReserva.fecha,
          cantidad: newReserva.cantidad,
          evento: newReserva.evento,
          notas: newReserva.notas,
        }),
      });
      setShowNewReserva(false);
      setNewReserva({ inflableId: 0, clienteNombre: "", fecha: "", cantidad: 1, evento: "", notas: "" });
      await loadData();
    } finally {
      submitLocksRef.current.reserva = false;
      setReservaSubmitting(false);
    }
  };

  const handleAddReservaCarrito = async () => {
    if (!newResCarrito.carritoId || !newResCarrito.clienteNombre || !newResCarrito.fecha || !newResCarrito.cantidad) return;
    if (submitLocksRef.current.reservaCarrito || reservaCarritoSubmitting) return;
    const carrito = carritos.find(c => c.id === newResCarrito.carritoId);
    if (!carrito) return;
    const reserved = getCarritoReservedCount(newResCarrito.carritoId, newResCarrito.fecha);
    if (reserved + newResCarrito.cantidad > carrito.cantidadTotal) {
      alert(`Solo hay ${carrito.cantidadTotal - reserved} unidad(es) disponible(s) del Carrito ${carrito.modelo} para esa fecha. No se puede crear la reserva para evitar sobreventa.`);
      return;
    }
    submitLocksRef.current.reservaCarrito = true;
    setReservaCarritoSubmitting(true);
    try {
      // carritoId es tipo_id; usar la primera unidad física disponible del grupo
      const unitId = carrito.unitIds[0];
      await apiRequest(`/carritos/${unitId}/reservas`, {
        method: "POST",
        body: JSON.stringify({
          cliente_nombre: newResCarrito.clienteNombre,
          fecha: newResCarrito.fecha,
          cantidad: newResCarrito.cantidad,
          evento: newResCarrito.evento,
          notas: newResCarrito.notas,
        }),
      });
      setShowNewReservaCarrito(false);
      setNewResCarrito({ carritoId: 0, clienteNombre: "", fecha: "", cantidad: 1, evento: "", notas: "" });
      await loadData();
    } finally {
      submitLocksRef.current.reservaCarrito = false;
      setReservaCarritoSubmitting(false);
    }
  };

  const handleDeleteReserva = async (id: number) => {
    const reserva = reservas.find((r) => r.id === id);
    if (!reserva) return;
    setDeleteTarget({ kind: "reserva", id, label: `${reserva.clienteNombre} - ${reserva.evento}` });
  };

  const handleDeleteReservaCarrito = async (id: number) => {
    const reserva = reservasCarritos.find((r) => r.id === id);
    if (!reserva) return;
    setDeleteTarget({ kind: "reservaCarrito", id, label: `${reserva.clienteNombre} - ${reserva.evento}` });
  };

  const deleteUploadedImagen = async (path: string): Promise<boolean> => {
    if (!path) return true;
    try {
      await apiRequest<{ ok?: boolean }>("/upload", {
        method: "DELETE",
        body: JSON.stringify({ path }),
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleInflableImagenUpload = async (file: File) => {
    setIsUploadingImagen(true);
    setUploadImagenError("");

    try {
      if (inflableImagen.path) {
        const cleaned = await deleteUploadedImagen(inflableImagen.path);
        if (!cleaned) {
          throw new Error("No se pudo eliminar la imagen anterior. Intenta de nuevo antes de subir otra.");
        }
        setInflableImagen({ url: "", path: "", name: "" });
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "inflables");

      const response = await fetch(`${API_BASE_URL}/upload`, { method: "POST", body: fd });

      if (!response.ok) {
        const ct = response.headers.get("content-type") || "";
        const errorData = ct.includes("application/json") ? await response.json() : { error: `HTTP ${response.status}` };
        throw new Error((errorData as any).error || "Error al subir la imagen");
      }

      const data = await response.json();
      const rawUrl = data?.url || data?.fileUrl || data?.secure_url || data?.location || data?.data?.url || "";
      const rawPath = data?.path || data?.filePath || data?.data?.path || extractStoragePathFromUrl(rawUrl);

      if (!rawUrl) throw new Error("La API respondió sin URL del archivo subido");
      if (!rawPath) throw new Error("La API respondió sin path del archivo subido");

      const normalizedUrl =
        typeof rawUrl === "string" && rawUrl.startsWith("/")
          ? `${new URL(API_BASE_URL, window.location.origin).origin}${rawUrl}`
          : rawUrl;

      setInflableImagen({ url: normalizedUrl, path: rawPath, name: file.name });
    } catch (err) {
      setUploadImagenError(err instanceof Error ? err.message : "Error al subir la imagen");
      setInflableImagen({ url: "", path: "", name: "" });
    } finally {
      setIsUploadingImagen(false);
    }
  };

  const cleanupInflableImagen = async (): Promise<boolean> => {
    if (!inflableImagen.path) return true;
    setIsCleaningImagen(true);
    const ok = await deleteUploadedImagen(inflableImagen.path);
    setIsCleaningImagen(false);
    if (ok) setInflableImagen({ url: "", path: "", name: "" });
    return ok;
  };

  const handleOpenEditInflable = (inflable: InflableType) => {
    setEditInflableData(inflable);
    setEditInflableForm({
      nombre: inflable.nombre,
      descripcion: inflable.descripcion,
      precioAlquiler: inflable.precioAlquiler,
      dimensiones: inflable.dimensiones,
      edadMinima: inflable.edadMinima,
    });
    setEditInflableImagen({ url: inflable.imagen.startsWith("http") ? inflable.imagen : "", path: "", name: "" });
    setUploadEditImagenError("");
    setShowEditInflable(true);
  };

  const handleEditInflableImagenUpload = async (file: File) => {
    setIsUploadingEditImagen(true);
    setUploadEditImagenError("");
    try {
      if (editInflableImagen.path) {
        const cleaned = await deleteUploadedImagen(editInflableImagen.path);
        if (!cleaned) throw new Error("No se pudo eliminar la imagen anterior. Intenta de nuevo.");
        setEditInflableImagen({ url: "", path: "", name: "" });
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "inflables");

      const response = await fetch(`${API_BASE_URL}/upload`, { method: "POST", body: fd });
      if (!response.ok) {
        const ct = response.headers.get("content-type") || "";
        const errorData = ct.includes("application/json") ? await response.json() : { error: `HTTP ${response.status}` };
        throw new Error((errorData as any).error || "Error al subir la imagen");
      }

      const data = await response.json();
      const rawUrl = data?.url || data?.fileUrl || data?.secure_url || data?.location || data?.data?.url || "";
      const rawPath = data?.path || data?.filePath || data?.data?.path || extractStoragePathFromUrl(rawUrl);

      if (!rawUrl) throw new Error("La API respondió sin URL del archivo subido");
      if (!rawPath) throw new Error("La API respondió sin path del archivo subido");

      const normalizedUrl = typeof rawUrl === "string" && rawUrl.startsWith("/")
        ? `${new URL(API_BASE_URL, window.location.origin).origin}${rawUrl}`
        : rawUrl;

      setEditInflableImagen({ url: normalizedUrl, path: rawPath, name: file.name });
    } catch (err) {
      setUploadEditImagenError(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setIsUploadingEditImagen(false);
    }
  };

  const cleanupEditInflableImagen = async (): Promise<boolean> => {
    if (!editInflableImagen.path) return true;
    setIsCleaningEditImagen(true);
    const ok = await deleteUploadedImagen(editInflableImagen.path);
    setIsCleaningEditImagen(false);
    if (ok) setEditInflableImagen({ url: "", path: "", name: "" });
    return ok;
  };

  const handleUpdateInflable = async () => {
    if (!editInflableData || !editInflableForm.nombre || !editInflableForm.descripcion || !editInflableForm.precioAlquiler) return;
    if (editInflableSubmitting) return;
    setEditInflableSubmitting(true);
    setUploadEditImagenError("");
    try {
      const imageUrl = editInflableImagen.url || editInflableData.imagen;
      await apiRequest(`/inflables/tipos/${editInflableData.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre: editInflableForm.nombre,
          descripcion: editInflableForm.descripcion,
          precio_alquiler: editInflableForm.precioAlquiler,
          dimensiones: editInflableForm.dimensiones,
          edad_minima: editInflableForm.edadMinima,
          imagen_url: imageUrl,
        }),
      });
      setEditInflableImagen(prev => ({ ...prev, path: "" }));
      setShowEditInflable(false);
      setEditInflableData(null);
      setUploadEditImagenError("");
      await loadData();
    } catch (err) {
      let cleanupFailed = false;
      if (editInflableImagen.path) {
        setIsCleaningEditImagen(true);
        const cleaned = await deleteUploadedImagen(editInflableImagen.path);
        setIsCleaningEditImagen(false);
        cleanupFailed = !cleaned;
        if (cleaned) setEditInflableImagen({ url: "", path: "", name: "" });
      }
      const base = err instanceof Error ? err.message : "No se pudo actualizar el inflable";
      setUploadEditImagenError(cleanupFailed ? `${base}. Además, no se pudo eliminar la imagen subida.` : base);
    } finally {
      setEditInflableSubmitting(false);
    }
  };

  const handleAddInflable = async () => {
    if (!newInflable.nombre || !newInflable.descripcion || !newInflable.precioAlquiler || !inflableImagen.url) return;
    if (submitLocksRef.current.inflable || inflableSubmitting) return;
    submitLocksRef.current.inflable = true;
    setInflableSubmitting(true);
    setUploadImagenError("");
    try {
      await apiRequest("/inflables/tipos", {
        method: "POST",
        body: JSON.stringify({
          nombre: newInflable.nombre,
          descripcion: newInflable.descripcion,
          precio_alquiler: newInflable.precioAlquiler,
          dimensiones: newInflable.dimensiones,
          edad_minima: newInflable.edadMinima,
          imagen_url: inflableImagen.url,
        }),
      });
      // Guardado OK — el archivo queda en propiedad del tipo, no limpiar
      setInflableImagen((prev) => ({ ...prev, path: "" }));
      setShowNewInflable(false);
      setNewInflable({ nombre: "", descripcion: "", precioAlquiler: 0, dimensiones: "", edadMinima: "" });
      setInflableImagen({ url: "", path: "", name: "" });
      setUploadImagenError("");
      await loadData();
    } catch (err) {
      // Guardado falló — intentar limpiar la imagen huérfana
      let cleanupFailed = false;
      if (inflableImagen.path) {
        setIsCleaningImagen(true);
        const cleaned = await deleteUploadedImagen(inflableImagen.path);
        setIsCleaningImagen(false);
        cleanupFailed = !cleaned;
        if (cleaned) setInflableImagen({ url: "", path: "", name: "" });
      }
      const base = err instanceof Error ? err.message : "No se pudo guardar el tipo de inflable";
      setUploadImagenError(cleanupFailed ? `${base}. Además, no se pudo eliminar la imagen subida.` : base);
    } finally {
      submitLocksRef.current.inflable = false;
      setInflableSubmitting(false);
    }
  };

  const handleAddUnidad = async () => {
    if (!newUnidad.tipoId || !newUnidad.codigo.trim()) return;
    if (submitLocksRef.current.unidad || unidadSubmitting) return;
    submitLocksRef.current.unidad = true;
    setUnidadSubmitting(true);
    try {
      await apiRequest("/inflables", {
        method: "POST",
        body: JSON.stringify({
          tipo_id: newUnidad.tipoId,
          codigo: newUnidad.codigo.trim(),
          estado: newUnidad.estado,
          fecha_adquisicion: newUnidad.fechaAdquisicion || null,
        }),
      });
      setShowNewUnidad(false);
      setNewUnidad({ tipoId: 0, codigo: "", estado: "disponible", fechaAdquisicion: "" });
      await loadData();
    } finally {
      submitLocksRef.current.unidad = false;
      setUnidadSubmitting(false);
    }
  };

  const handleDeleteInflable = async (id: number) => {
    const inflable = inflables.find((item) => item.id === id);
    if (!inflable) return;
    setDeleteTarget({ kind: "inflable", id, label: inflable.nombre });
  };

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);
    try {
      if (deleteTarget.kind === "reserva") {
        const reserva = reservas.find((item) => item.id === deleteTarget.id);
        if (!reserva) return;
        await apiRequest(`/inflables/${reserva.inflableId}/reservas/${deleteTarget.id}`, { method: "DELETE" });
      } else if (deleteTarget.kind === "reservaCarrito") {
        const reserva = reservasCarritos.find((item) => item.id === deleteTarget.id);
        if (!reserva) return;
        await apiRequest(`/carritos/${reserva.unitId}/reservas/${deleteTarget.id}`, { method: "DELETE" });
      } else {
        await apiRequest(`/inflables/tipos/${deleteTarget.id}`, { method: "DELETE" });
        if (selectedType?.id === deleteTarget.id) setSelectedType(null);
      }
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el registro");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleAddAlerta = async () => {
    if (!newAlerta.recursoId || !newAlerta.titulo || !newAlerta.descripcion) return;
    if (submitLocksRef.current.alerta || alertaSubmitting) return;
    const recurso = newAlerta.recursoTipo === "inflable"
      ? inflables.find(i => i.id === newAlerta.recursoId)
      : carritos.find(c => c.id === newAlerta.recursoId);
    if (!recurso) return;
    submitLocksRef.current.alerta = true;
    setAlertaSubmitting(true);
    try {
      await apiRequest("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          recurso_tipo: newAlerta.recursoTipo,
          recurso_id: newAlerta.recursoId,
          recurso_nombre: (recurso as InflableType).nombre || (recurso as Carrito).modelo,
          severidad: newAlerta.severidad,
          estado: "pendiente",
          titulo: newAlerta.titulo,
          descripcion: newAlerta.descripcion,
          reportado_por: newAlerta.reportadoPor || "Sistema",
          fecha_reporte: todayStr,
        }),
      });
      setShowNewAlerta(false);
      setNewAlerta({ recursoTipo: "inflable", recursoId: 0, severidad: "advertencia", titulo: "", descripcion: "", reportadoPor: "" });
      await loadData();
    } finally {
      submitLocksRef.current.alerta = false;
      setAlertaSubmitting(false);
    }
  };

  const handleUpdateAlertaEstado = async (id: number, nuevoEstado: EstadoAlerta) => {
    await apiRequest(`/maintenance/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        estado: nuevoEstado,
        ...(nuevoEstado === "resuelta" ? { fecha_resolucion: todayStr } : {}),
      }),
    });
    await loadData();
  };

  // ── Render ─────────────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);

  const filteredAlertas = alertaFilter === "all" ? alertas : alertas.filter(a => a.estado === alertaFilter);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Inflables y Carritos</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestión de alquiler, stock y mantenimiento</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-5 md:mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1"><Wind className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" /><span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Inflables</span></div>
          <p className="text-2xl text-gray-900 dark:text-white">{totalInflables - reservadosInflablesHoy}<span className="text-sm text-gray-400">/{totalInflables}</span></p>
          <p className="text-[10px] text-gray-400">disponibles hoy</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1"><ShoppingCart className="w-4 h-4 text-[#EF8022]" /><span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Carritos</span></div>
          <p className="text-2xl text-gray-900 dark:text-white">{totalCarritos - reservadosCarritosHoy}<span className="text-sm text-gray-400">/{totalCarritos}</span></p>
          <p className="text-[10px] text-gray-400">disponibles hoy</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-green-500" /><span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Rsv. Inflables</span></div>
          <p className="text-2xl text-green-600 dark:text-green-400">{reservas.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-purple-500" /><span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Rsv. Carritos</span></div>
          <p className="text-2xl text-purple-600 dark:text-purple-400">{reservasCarritos.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-500" /><span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Alertas Pend.</span></div>
          <p className="text-2xl text-amber-600 dark:text-amber-400">{alertasPendientes}</p>
        </div>
        <div className={`p-4 rounded-xl border ${alertasCriticas > 0 ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}>
          <div className="flex items-center gap-2 mb-1"><AlertCircle className={`w-4 h-4 ${alertasCriticas > 0 ? "text-red-500" : "text-gray-400"}`} /><span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Críticas</span></div>
          <p className={`text-2xl ${alertasCriticas > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>{alertasCriticas}</p>
          {alertasCriticas > 0 && <p className="text-[10px] text-red-500">Requiere atención</p>}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {([
            { key: "inflables" as const, label: "Inflables", icon: Wind },
            { key: "carritos" as const, label: "Stock Carritos", icon: ShoppingCart },
            { key: "mantenimiento" as const, label: "Mantenimiento", icon: Wrench, badge: alertasCriticas > 0 },
            { key: "calendario" as const, label: "Calendario", icon: Calendar },
          ]).map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => { setMainTab(tab.key); setSearchTerm(""); setSelectedType(null); setSelectedCarrito(null); setSelectedDate(null); setSelectedFichaCal(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm transition-colors relative ${mainTab === tab.key ? "bg-[#EF8022]/10 text-[#EF8022] border-b-2 border-[#EF8022]" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}>
                <Icon className="w-4 h-4" /> {tab.label}
                {tab.badge && <span className="absolute top-2 right-[calc(50%-40px)] w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* INFLABLES TAB */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === "inflables" && (
        <>
          {/* Search + Buttons */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Buscar inflable..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent" />
              </div>
              <div className="flex gap-3 w-full lg:w-auto items-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">Reservas desde <span className="text-[#EF8022]">Fichas de Eventos</span></p>
                {canManage && (
                  <>
                    <button onClick={() => { setNewUnidad({ tipoId: selectedType?.id ?? 0, codigo: "", estado: "disponible", fechaAdquisicion: "" }); setShowNewUnidad(true); }} className="border border-[#1F3C8B] text-[#1F3C8B] dark:text-blue-400 px-5 py-3 rounded-lg hover:bg-[#1F3C8B]/10 transition-colors flex items-center gap-2 whitespace-nowrap text-sm">
                      <Plus className="w-4 h-4" /> Nueva Unidad
                    </button>
                    <button onClick={() => setShowNewInflable(true)} className="bg-[#1F3C8B] text-white px-5 py-3 rounded-lg hover:bg-[#1F3C8B]/90 transition-colors flex items-center gap-2 whitespace-nowrap text-sm">
                      <Plus className="w-4 h-4" /> Nuevo Tipo
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Inflables list */}
            <div className="xl:col-span-1 flex flex-col gap-3">
              <h2 className="text-lg text-gray-900 dark:text-white">
                Tipos de Inflables
                <span className="ml-2 text-sm text-gray-400 font-normal">({filteredInflables.length})</span>
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] pr-1 xl:sticky xl:top-4">
              {filteredInflables.map(inflable => {
                const dateForAvail = selectedDate || todayStr;
                const reservedOnDate = getReservedCount(inflable.id, dateForAvail);
                const availOnDate = inflable.cantidadUnidades - reservedOnDate;
                const isSelected = selectedType?.id === inflable.id;
                const maxSev = getMaxSeverity("inflable", inflable.id);
                const activeAlertCount = getActiveAlerts("inflable", inflable.id).length;
                const isUsedOnSelectedDate = !!selectedDate && reservedOnDate > 0;

                return (
                  <div key={inflable.id} onClick={() => setSelectedType(isSelected ? null : inflable)}
                    className={`border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md relative flex h-40 ${isSelected ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10" : isUsedOnSelectedDate ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10" : maxSev === "critica" ? "border-red-300 dark:border-red-700 bg-white dark:bg-gray-800" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                    
                    {/* Image Section - Half of the card */}
                    <div className="w-1/2 bg-gray-100 dark:bg-gray-700 relative overflow-hidden group">
                      {inflable.imagen.startsWith("http") ? (
                        <img src={inflable.imagen} alt={inflable.nombre} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl">
                          {EMOJI_MAP[inflable.imagen] || "🎈"}
                        </div>
                      )}
                      
                      {/* Maintenance Alert Icon - Floated over image */}
                      {maxSev && (
                        <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] backdrop-blur-md shadow-sm ${maxSev === "critica" ? "bg-red-500/90 text-white" : maxSev === "advertencia" ? "bg-amber-500/90 text-white" : "bg-blue-500/90 text-white"}`}>
                          {maxSev === "critica" ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {activeAlertCount}
                        </div>
                      )}
                    </div>

                    {/* Content Section - Other half */}
                    <div className="w-1/2 p-4 flex flex-col justify-between min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={inflable.nombre}>{inflable.nombre}</h3>
                        {canManage && (
                          <button
                            onClick={e => { e.stopPropagation(); handleOpenEditInflable(inflable); }}
                            className="p-1 rounded hover:bg-[#1F3C8B]/10 text-gray-400 hover:text-[#1F3C8B] dark:hover:text-blue-400 transition-colors shrink-0"
                            title="Editar inflable"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[9px]">Precio Alquiler</span>
                          <span className="text-sm font-bold text-[#EF8022]">S/ {inflable.precioAlquiler}</span>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[9px]">Disponibilidad</span>
                          <span className={`text-[10px] w-fit px-2 py-0.5 rounded-full font-medium ${availOnDate > 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
                            {availOnDate}/{inflable.cantidadUnidades} unidades
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Calendar */}
            <div className="xl:col-span-2 space-y-6">
              {renderCalendar(calendarYear, calendarMonth, setCalendarYear, setCalendarMonth, calendarReservationMap, calendarMaxCap, selectedDate, setSelectedDate, todayStr, selectedType?.nombre)}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CARRITOS TAB */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === "carritos" && (
        <>
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Buscar carrito..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Reservas desde <span className="text-[#EF8022]">Fichas de Eventos</span></p>
            </div>
          </div>

          {/* Overbooking warning */}
          {(() => {
            const overbooked: { carrito: Carrito; fecha: string; reservado: number }[] = [];
            carritos.forEach(c => {
              const days = getDaysInMonth(calendarYear, calendarMonth);
              for (let d = 1; d <= days; d++) {
                const dateStr = formatDate(new Date(calendarYear, calendarMonth, d));
                const reserved = getCarritoReservedCount(c.id, dateStr);
                if (reserved > c.cantidadTotal) overbooked.push({ carrito: c, fecha: dateStr, reservado: reserved });
              }
            });
            if (overbooked.length === 0) return null;
            return (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-400 mb-2">Alerta de Sobreventa Detectada</p>
                    <div className="space-y-1">
                      {overbooked.map((ob, i) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400">
                          Carrito <strong>{ob.carrito.modelo}</strong> el <strong>{ob.fecha}</strong>: {ob.reservado} reservados / {ob.carrito.cantidadTotal} disponibles
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Carritos list */}
            <div className="xl:col-span-1 space-y-3">
              <h2 className="text-lg text-gray-900 dark:text-white mb-2">Modelos de Carritos</h2>
              {filteredCarritos.map(carrito => {
                const reservedToday = getCarritoReservedCount(carrito.id, todayStr);
                const availToday = carrito.cantidadTotal - reservedToday;
                const isSelected = selectedCarrito?.id === carrito.id;
                const maxSev = getMaxSeverity("carrito", carrito.id);
                const activeAlertCount = getActiveAlerts("carrito", carrito.id).length;

                return (
                  <div key={carrito.id} onClick={() => setSelectedCarrito(isSelected ? null : carrito)}
                    className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md relative ${isSelected ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10" : maxSev === "critica" ? "border-red-300 dark:border-red-700 bg-white dark:bg-gray-800" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                    {/* Maintenance Alert Icon */}
                    {maxSev && (
                      <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] ${maxSev === "critica" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : maxSev === "advertencia" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}>
                        {maxSev === "critica" ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {activeAlertCount}
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="text-2xl w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg shrink-0">
                        {CARRITO_EMOJI[carrito.imagen] || "🛒"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm text-gray-900 dark:text-white">Carrito {carrito.modelo}</h3>
                          <span className="text-[10px] text-gray-400 font-mono">{carrito.codigo}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{carrito.descripcion}</p>

                        {/* Stock bar */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-gray-400">Stock hoy</span>
                            <span className={`${availToday <= 0 ? "text-red-500" : availToday <= 1 ? "text-amber-500" : "text-green-500"}`}>{availToday} de {carrito.cantidadTotal}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${availToday <= 0 ? "bg-red-500" : availToday <= 1 ? "bg-amber-500" : "bg-green-500"}`}
                              style={{ width: `${Math.max(0, (availToday / carrito.cantidadTotal) * 100)}%` }} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#EF8022]">S/ {carrito.precioAlquiler}/día</span>
                          {availToday <= 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Agotado</span>}
                          {availToday === 1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Último!</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar + Detail */}
            <div className="xl:col-span-2 space-y-6">
              {renderCalendar(calendarYear, calendarMonth, setCalendarYear, setCalendarMonth, calendarReservationMap, calendarMaxCap, selectedDate, setSelectedDate, todayStr, selectedCarrito ? `Carrito ${selectedCarrito.modelo}` : undefined)}

              {/* Day Detail for carritos */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
                  {selectedDate
                    ? `Reservas del ${new Date(selectedDate + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}`
                    : "Reservas de Hoy"}
                </h3>
                {(() => {
                  const dateToShow = selectedDate || todayStr;
                  const dayRes = getReservasCarritoByDate(dateToShow);
                  if (dayRes.length === 0) {
                    return (<div className="text-center py-8"><ShoppingCart className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400 text-sm">No hay reservas de carritos para este día</p></div>);
                  }
                  return (
                    <div className="space-y-3">
                      {/* Availability grid */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {carritos.map(c => {
                          const reserved = getCarritoReservedCount(c.id, dateToShow);
                          const avail = c.cantidadTotal - reserved;
                          const isOver = reserved > c.cantidadTotal;
                          return (
                            <div key={c.id} className={`text-center p-3 rounded-lg border text-xs ${isOver ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" : avail === 0 ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20" : reserved > 0 ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"}`}>
                              <span className="text-lg">{CARRITO_EMOJI[c.imagen]}</span>
                              <p className="text-gray-700 dark:text-gray-300 truncate mt-1">{c.modelo}</p>
                              <p className={`mt-1 ${isOver ? "text-red-600 dark:text-red-400" : avail === 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                {avail}/{c.cantidadTotal}
                              </p>
                              {isOver && <p className="text-[9px] text-red-500 mt-0.5">SOBREVENTA</p>}
                            </div>
                          );
                        })}
                      </div>
                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Carrito</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Evento</th>
                              <th className="text-center py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Cant.</th>
                              {canManage && <th className="text-center py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase"></th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {dayRes.map(r => {
                              const c = carritos.find(c => c.id === r.carritoId);
                              return (
                                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="py-3 px-3"><div className="flex items-center gap-2"><span className="text-lg">{CARRITO_EMOJI[c?.imagen || ""]}</span><span className="text-gray-900 dark:text-white">{c?.modelo}</span></div></td>
                                  <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{r.clienteNombre}</td>
                                  <td className="py-3 px-3"><span className="text-xs px-2 py-1 rounded-full bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 text-[#1F3C8B] dark:text-blue-400">{r.evento}</span></td>
                                  <td className="py-3 px-3 text-center text-gray-900 dark:text-white">{r.cantidad}</td>
                                  {canManage && (
                                    <td className="py-3 px-3 text-center"><button onClick={e => { e.stopPropagation(); handleDeleteReservaCarrito(r.id); }} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button></td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MANTENIMIENTO TAB */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === "mantenimiento" && (
        <>
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex gap-2">
                {(["all", "pendiente", "en-proceso", "resuelta"] as const).map(f => (
                  <button key={f} onClick={() => setAlertaFilter(f)}
                    className={`px-4 py-2 rounded-lg text-xs transition-colors ${alertaFilter === f
                      ? f === "pendiente" ? "bg-red-500 text-white" : f === "en-proceso" ? "bg-amber-500 text-white" : f === "resuelta" ? "bg-green-500 text-white" : "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                    {f === "all" ? "Todas" : f === "pendiente" ? "Pendientes" : f === "en-proceso" ? "En Proceso" : "Resueltas"}
                    {f !== "all" && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-white/20 text-[10px]">
                      {alertas.filter(a => a.estado === f).length}
                    </span>}
                  </button>
                ))}
              </div>
              {canManage && (
                <button onClick={() => setShowNewAlerta(true)} className="bg-red-500 text-white px-5 py-2.5 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 whitespace-nowrap text-sm">
                  <Plus className="w-4 h-4" /> Reportar Problema
                </button>
              )}
            </div>
          </div>

          {/* Alerts list */}
          <div className="space-y-3">
            {filteredAlertas.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No hay alertas {alertaFilter !== "all" ? `con estado "${alertaFilter}"` : ""}</p>
              </div>
            )}

            {filteredAlertas.map(alerta => (
              <div key={alerta.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-5 transition-all hover:shadow-md ${alerta.severidad === "critica" && alerta.estado !== "resuelta" ? "border-red-300 dark:border-red-700" : alerta.severidad === "advertencia" && alerta.estado !== "resuelta" ? "border-amber-300 dark:border-amber-700" : "border-gray-200 dark:border-gray-700"}`}>
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${alerta.severidad === "critica" ? "bg-red-100 dark:bg-red-900/30" : alerta.severidad === "advertencia" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                    {alerta.severidad === "critica" ? <AlertCircle className="w-5 h-5 text-red-500" /> : alerta.severidad === "advertencia" ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <Bell className="w-5 h-5 text-blue-500" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm text-gray-900 dark:text-white mb-1">{alerta.titulo}</h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeveridadBadge severidad={alerta.severidad} />
                          <EstadoAlertaBadge estado={alerta.estado} />
                          <span className={`text-[10px] px-2 py-0.5 rounded ${alerta.recursoTipo === "inflable" ? "bg-[#1F3C8B]/10 text-[#1F3C8B] dark:bg-[#1F3C8B]/20 dark:text-blue-400" : "bg-[#EF8022]/10 text-[#EF8022] dark:bg-[#EF8022]/20"}`}>
                            {alerta.recursoTipo === "inflable" ? "Inflable" : "Carrito"}: {alerta.recursoNombre}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{alerta.descripcion}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-[10px] text-gray-400">
                        <span>Reportado por: {alerta.reportadoPor}</span>
                        <span>{alerta.fechaReporte}</span>
                        {alerta.fechaResolucion && <span className="text-green-500">Resuelto: {alerta.fechaResolucion}</span>}
                      </div>

                      {alerta.estado !== "resuelta" && canManage && (
                        <div className="flex gap-1.5">
                          {alerta.estado === "pendiente" && (
                            <button onClick={() => handleUpdateAlertaEstado(alerta.id, "en-proceso")}
                              className="px-3 py-1.5 text-[10px] rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1">
                              <Wrench className="w-3 h-3" /> Iniciar Reparación
                            </button>
                          )}
                          <button onClick={() => handleUpdateAlertaEstado(alerta.id, "resuelta")}
                            className="px-3 py-1.5 text-[10px] rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Marcar Resuelta
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CALENDARIO TAB */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mainTab === "calendario" && (
        <>
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Buscar ficha por título, cliente o distrito..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{fichasCalendario.length} ficha{fichasCalendario.length !== 1 ? "s" : ""} de Juguetón</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Fichas list */}
            <div className="xl:col-span-1 space-y-3">
              <h2 className="text-lg text-gray-900 dark:text-white mb-2">Fichas Programadas</h2>
              {filteredFichasCalendario.length === 0 && (
                <div className="text-center py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No hay fichas para mostrar</p>
                </div>
              )}
              {filteredFichasCalendario.map(f => {
                const isSelected = selectedFichaCal?.id === f.id;
                return (
                  <div key={f.id} onClick={() => {
                      const d = new Date(f.fecha + "T12:00:00");
                      setCalendarYear(d.getFullYear());
                      setCalendarMonth(d.getMonth());
                      setSelectedDate(f.fecha);
                      setSelectedFichaCal(isSelected ? null : f);
                    }}
                    className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${isSelected ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm text-gray-900 dark:text-white truncate">{f.titulo || f.clienteNombre}</h3>
                      <span className="text-[10px] text-gray-400 shrink-0">#{f.id}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{f.clienteNombre}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(f.fecha + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</span>
                      {f.horaEntrega && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {f.horaEntrega.slice(0, 5)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar + Detail */}
            <div className="xl:col-span-2 space-y-6">
              {renderFichasCalendar(calendarYear, calendarMonth, setCalendarYear, setCalendarMonth, calendarFichasMap, selectedDate, setSelectedDate, todayStr)}

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
                  {selectedDate
                    ? `Fichas del ${new Date(selectedDate + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}`
                    : "Fichas de Hoy"}
                </h3>
                {(() => {
                  const dateToShow = selectedDate || todayStr;
                  const dayFichas = getFichasByDate(dateToShow);
                  if (dayFichas.length === 0) {
                    return (<div className="text-center py-8"><Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400 text-sm">No hay fichas para este día</p></div>);
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Título</th>
                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Distrito</th>
                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Hora</th>
                            <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {dayFichas.map(f => (
                            <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-3 px-3 text-gray-900 dark:text-white">{f.titulo || <span className="text-gray-400 italic">Sin título</span>}</td>
                              <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{f.clienteNombre}</td>
                              <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{f.distrito || "—"}</td>
                              <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{f.horaEntrega ? f.horaEntrega.slice(0, 5) : "—"}</td>
                              <td className="py-3 px-3"><span className="text-xs px-2 py-1 rounded-full bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 text-[#1F3C8B] dark:text-blue-400">{f.tipoEvento || "—"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* New Reserva Inflable Modal */}
      {showNewReserva && (
        <ModalWrapper onClose={() => setShowNewReserva(false)}>
          <h3 className="text-xl text-gray-900 dark:text-white mb-6">Nueva Reserva de Inflable</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo de Inflable *</label>
              <select value={newReserva.inflableId} onChange={e => setNewReserva({ ...newReserva, inflableId: Number(e.target.value) })} className={inputClass}>
                <option value={0}>Seleccionar inflable...</option>
                {inflables.map(inf => {
                  const alertSev = getMaxSeverity("inflable", inf.id);
                  return <option key={inf.id} value={inf.id}>{alertSev === "critica" ? "⚠️ " : ""}{inf.nombre} — {inf.cantidadUnidades} uds (S/ {inf.precioAlquiler}/día)</option>;
                })}
              </select>
              {newReserva.inflableId > 0 && getMaxSeverity("inflable", newReserva.inflableId) === "critica" && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Este inflable tiene una alerta cr��tica de mantenimiento activa</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Fecha (día completo) *</label>
              <input type="date" value={newReserva.fecha} onChange={e => setNewReserva({ ...newReserva, fecha: e.target.value })} className={inputClass} />
              {newReserva.inflableId > 0 && newReserva.fecha && (() => {
                const inf = inflables.find(i => i.id === newReserva.inflableId)!;
                const reserved = getReservedCount(inf.id, newReserva.fecha);
                const avail = inf.cantidadUnidades - reserved;
                return <p className={`text-xs mt-1 ${avail > 0 ? "text-gray-500" : "text-red-500"}`}>{avail > 0 ? `${avail} de ${inf.cantidadUnidades} disponible(s)` : "No hay disponibilidad"}</p>;
              })()}
            </div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cantidad *</label>
              <input type="number" min={1} max={10} value={newReserva.cantidad} onChange={e => setNewReserva({ ...newReserva, cantidad: Number(e.target.value) })} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
              <input type="text" placeholder="Nombre del cliente" value={newReserva.clienteNombre} onChange={e => setNewReserva({ ...newReserva, clienteNombre: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Evento</label>
              <input type="text" placeholder="Ej: Cumpleaños..." value={newReserva.evento} onChange={e => setNewReserva({ ...newReserva, evento: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Notas</label>
              <textarea placeholder="Observaciones..." value={newReserva.notas} onChange={e => setNewReserva({ ...newReserva, notas: e.target.value })} rows={2} className={`${inputClass} resize-none`} /></div>
            <ModalButtons onCancel={() => setShowNewReserva(false)} onConfirm={handleAddReserva} label="Crear Reserva" submitting={reservaSubmitting} />
          </div>
        </ModalWrapper>
      )}

      {/* New Reserva Carrito Modal */}
      {showNewReservaCarrito && (
        <ModalWrapper onClose={() => setShowNewReservaCarrito(false)}>
          <h3 className="text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-[#EF8022]" /> Nueva Reserva de Carrito</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Modelo de Carrito *</label>
              <select value={newResCarrito.carritoId} onChange={e => setNewResCarrito({ ...newResCarrito, carritoId: Number(e.target.value) })} className={inputClass}>
                <option value={0}>Seleccionar carrito...</option>
                {carritos.map(c => {
                  const alertSev = getMaxSeverity("carrito", c.id);
                  return <option key={c.id} value={c.id}>{alertSev === "critica" ? "⚠️ " : ""}{c.modelo} — {c.cantidadTotal} uds (S/ {c.precioAlquiler}/día)</option>;
                })}
              </select>
              {newResCarrito.carritoId > 0 && getMaxSeverity("carrito", newResCarrito.carritoId) === "critica" && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Este carrito tiene una alerta crítica activa</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Fecha (día completo) *</label>
              <input type="date" value={newResCarrito.fecha} onChange={e => setNewResCarrito({ ...newResCarrito, fecha: e.target.value })} className={inputClass} />
              {newResCarrito.carritoId > 0 && newResCarrito.fecha && (() => {
                const c = carritos.find(c => c.id === newResCarrito.carritoId)!;
                const reserved = getCarritoReservedCount(c.id, newResCarrito.fecha);
                const avail = c.cantidadTotal - reserved;
                return <p className={`text-xs mt-1 ${avail > 0 ? "text-gray-500" : "text-red-500"}`}>{avail > 0 ? `${avail} de ${c.cantidadTotal} disponible(s)` : "Agotado — se bloqueará la reserva"}</p>;
              })()}
            </div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cantidad *</label>
              <input type="number" min={1} max={20} value={newResCarrito.cantidad} onChange={e => setNewResCarrito({ ...newResCarrito, cantidad: Number(e.target.value) })} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
              <input type="text" placeholder="Nombre del cliente" value={newResCarrito.clienteNombre} onChange={e => setNewResCarrito({ ...newResCarrito, clienteNombre: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Evento</label>
              <input type="text" placeholder="Ej: Feria escolar..." value={newResCarrito.evento} onChange={e => setNewResCarrito({ ...newResCarrito, evento: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Notas</label>
              <textarea placeholder="Observaciones..." value={newResCarrito.notas} onChange={e => setNewResCarrito({ ...newResCarrito, notas: e.target.value })} rows={2} className={`${inputClass} resize-none`} /></div>
            <ModalButtons onCancel={() => setShowNewReservaCarrito(false)} onConfirm={handleAddReservaCarrito} label="Crear Reserva" submitting={reservaCarritoSubmitting} />
          </div>
        </ModalWrapper>
      )}

      {/* New Inflable Modal */}
      {showNewInflable && (
        <ModalWrapper onClose={async () => {
          if (inflableSubmitting || isUploadingImagen || isCleaningImagen) return;
          const ok = await cleanupInflableImagen();
          if (!ok) { setUploadImagenError("No se pudo eliminar la imagen subida. Intenta nuevamente antes de cerrar."); return; }
          setShowNewInflable(false);
          setUploadImagenError("");
          setNewInflable({ nombre: "", descripcion: "", precioAlquiler: 0, dimensiones: "", edadMinima: "" });
        }}>
          <h3 className="text-xl text-gray-900 dark:text-white mb-6">Nuevo Tipo de Inflable</h3>
          <div className="space-y-4">
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre *</label><input type="text" value={newInflable.nombre} onChange={e => setNewInflable({ ...newInflable, nombre: e.target.value })} placeholder="Ej: Tobogán Doble" className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción *</label><textarea value={newInflable.descripcion} onChange={e => setNewInflable({ ...newInflable, descripcion: e.target.value })} placeholder="Descripción..." rows={2} className={`${inputClass} resize-none`} /></div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Precio/día (S/) *</label>
              <input type="number" min={0} value={newInflable.precioAlquiler || ""} onChange={e => setNewInflable({ ...newInflable, precioAlquiler: Number(e.target.value) })} placeholder="350" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dimensiones</label><input type="text" value={newInflable.dimensiones} onChange={e => setNewInflable({ ...newInflable, dimensiones: e.target.value })} placeholder="Ej: 6m x 4m x 3m" className={inputClass} /></div>
              <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Rango de Edades</label><input type="text" value={newInflable.edadMinima} onChange={e => setNewInflable({ ...newInflable, edadMinima: e.target.value })} placeholder="Ej: 3 - 12 años" className={inputClass} /></div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Imagen *</label>
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm transition-colors ${
                isUploadingImagen || isCleaningImagen
                  ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-[#1F3C8B] hover:text-[#1F3C8B]"
              }`}>
                <Upload className="w-4 h-4" />
                <span>{isUploadingImagen ? "Subiendo..." : isCleaningImagen ? "Limpiando imagen..." : inflableImagen.name || "Subir imagen del inflable"}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingImagen || isCleaningImagen}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleInflableImagenUpload(f); }}
                />
              </label>
              {uploadImagenError && <p className="mt-1 text-xs text-red-500">{uploadImagenError}</p>}
              {inflableImagen.url && (
                <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <img src={inflableImagen.url} alt="Vista previa" className="max-h-48 w-full object-contain bg-black/5" />
                </div>
              )}
            </div>
            <ModalButtons
              onCancel={async () => {
                if (inflableSubmitting || isUploadingImagen || isCleaningImagen) return;
                const ok = await cleanupInflableImagen();
                if (!ok) { setUploadImagenError("No se pudo eliminar la imagen subida. Intenta nuevamente antes de cerrar."); return; }
                setShowNewInflable(false);
                setUploadImagenError("");
                setNewInflable({ nombre: "", descripcion: "", precioAlquiler: 0, dimensiones: "", edadMinima: "" });
              }}
              onConfirm={handleAddInflable}
              label="Guardar Tipo"
              submitting={inflableSubmitting || isCleaningImagen}
            />
          </div>
        </ModalWrapper>
      )}

      {/* New Unidad Modal */}
      {showNewUnidad && (
        <ModalWrapper onClose={() => setShowNewUnidad(false)}>
          <h3 className="text-xl text-gray-900 dark:text-white mb-6">Nueva Unidad Física</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo de Inflable *</label>
              <select value={newUnidad.tipoId} onChange={e => setNewUnidad({ ...newUnidad, tipoId: Number(e.target.value) })} className={inputClass}>
                <option value={0}>Seleccionar tipo...</option>
                {inflables.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Código *</label>
              <input type="text" value={newUnidad.codigo} onChange={e => setNewUnidad({ ...newUnidad, codigo: e.target.value })} placeholder="Ej: CAST-001" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Estado</label>
              <select value={newUnidad.estado} onChange={e => setNewUnidad({ ...newUnidad, estado: e.target.value as typeof newUnidad.estado })} className={inputClass}>
                <option value="disponible">Disponible</option>
                <option value="en-uso">En Uso</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Fecha de adquisición</label>
              <input type="date" value={newUnidad.fechaAdquisicion} onChange={e => setNewUnidad({ ...newUnidad, fechaAdquisicion: e.target.value })} className={inputClass} />
            </div>
            <ModalButtons onCancel={() => setShowNewUnidad(false)} onConfirm={handleAddUnidad} label="Guardar Unidad" submitting={unidadSubmitting} />
          </div>
        </ModalWrapper>
      )}

      {/* Edit Inflable Modal */}
      {showEditInflable && editInflableData && (
        <ModalWrapper onClose={async () => {
          if (editInflableSubmitting || isUploadingEditImagen || isCleaningEditImagen) return;
          const ok = await cleanupEditInflableImagen();
          if (!ok) { setUploadEditImagenError("No se pudo eliminar la imagen subida. Intenta nuevamente antes de cerrar."); return; }
          setShowEditInflable(false);
          setEditInflableData(null);
          setUploadEditImagenError("");
        }}>
          <h3 className="text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Pencil className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
            Editar Inflable
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
              <input type="text" value={editInflableForm.nombre} onChange={e => setEditInflableForm({ ...editInflableForm, nombre: e.target.value })} placeholder="Ej: Tobogán Doble" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción *</label>
              <textarea value={editInflableForm.descripcion} onChange={e => setEditInflableForm({ ...editInflableForm, descripcion: e.target.value })} placeholder="Descripción..." rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Precio/día (S/) *</label>
              <input type="number" min={0} value={editInflableForm.precioAlquiler || ""} onChange={e => setEditInflableForm({ ...editInflableForm, precioAlquiler: Number(e.target.value) })} placeholder="350" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dimensiones</label>
                <input type="text" value={editInflableForm.dimensiones} onChange={e => setEditInflableForm({ ...editInflableForm, dimensiones: e.target.value })} placeholder="Ej: 6m x 4m x 3m" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Rango de Edades</label>
                <input type="text" value={editInflableForm.edadMinima} onChange={e => setEditInflableForm({ ...editInflableForm, edadMinima: e.target.value })} placeholder="Ej: 3 - 12 años" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Imagen</label>
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm transition-colors ${
                isUploadingEditImagen || isCleaningEditImagen
                  ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-[#1F3C8B] hover:text-[#1F3C8B]"
              }`}>
                <Upload className="w-4 h-4" />
                <span>{isUploadingEditImagen ? "Subiendo..." : isCleaningEditImagen ? "Limpiando imagen..." : editInflableImagen.name || "Subir nueva imagen"}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingEditImagen || isCleaningEditImagen}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleEditInflableImagenUpload(f); }}
                />
              </label>
              {uploadEditImagenError && <p className="mt-1 text-xs text-red-500">{uploadEditImagenError}</p>}
              {editInflableImagen.url && (
                <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <img src={editInflableImagen.url} alt="Vista previa" className="max-h-48 w-full object-contain bg-black/5" />
                </div>
              )}
            </div>
            <ModalButtons
              onCancel={async () => {
                if (editInflableSubmitting || isUploadingEditImagen || isCleaningEditImagen) return;
                const ok = await cleanupEditInflableImagen();
                if (!ok) { setUploadEditImagenError("No se pudo eliminar la imagen subida. Intenta nuevamente antes de cerrar."); return; }
                setShowEditInflable(false);
                setEditInflableData(null);
                setUploadEditImagenError("");
              }}
              onConfirm={handleUpdateInflable}
              label="Guardar Cambios"
              submitting={editInflableSubmitting || isCleaningEditImagen}
            />
          </div>
        </ModalWrapper>
      )}

      {/* New Alerta Modal */}
      {showNewAlerta && (
        <ModalWrapper onClose={() => setShowNewAlerta(false)}>
          <h3 className="text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> Reportar Problema</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo de Recurso *</label>
                <select value={newAlerta.recursoTipo} onChange={e => setNewAlerta({ ...newAlerta, recursoTipo: e.target.value as TipoRecurso, recursoId: 0 })} className={inputClass}>
                  <option value="inflable">Inflable</option>
                  <option value="carrito">Carrito</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Recurso *</label>
                <select value={newAlerta.recursoId} onChange={e => setNewAlerta({ ...newAlerta, recursoId: Number(e.target.value) })} className={inputClass}>
                  <option value={0}>Seleccionar...</option>
                  {newAlerta.recursoTipo === "inflable"
                    ? inflables.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)
                    : carritos.map(c => <option key={c.id} value={c.id}>Carrito {c.modelo} ({c.codigo})</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Severidad *</label>
              <div className="flex gap-2">
                {(["critica", "advertencia", "info"] as SeveridadAlerta[]).map(s => (
                  <button key={s} onClick={() => setNewAlerta({ ...newAlerta, severidad: s })}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${newAlerta.severidad === s
                      ? s === "critica" ? "bg-red-500 text-white border-red-500" : s === "advertencia" ? "bg-amber-500 text-white border-amber-500" : "bg-blue-500 text-white border-blue-500"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                    {s === "critica" ? "Crítica" : s === "advertencia" ? "Advertencia" : "Informativa"}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Título del Problema *</label>
              <input type="text" value={newAlerta.titulo} onChange={e => setNewAlerta({ ...newAlerta, titulo: e.target.value })} placeholder="Ej: Tornillos sueltos en rueda" className={inputClass} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción Detallada *</label>
              <textarea value={newAlerta.descripcion} onChange={e => setNewAlerta({ ...newAlerta, descripcion: e.target.value })} placeholder="Describa el problema, ubicación del daño, urgencia..." rows={3} className={`${inputClass} resize-none`} /></div>
            <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Reportado por</label>
              <input type="text" value={newAlerta.reportadoPor} onChange={e => setNewAlerta({ ...newAlerta, reportadoPor: e.target.value })} placeholder="Nombre del responsable" className={inputClass} /></div>
            <ModalButtons onCancel={() => setShowNewAlerta(false)} onConfirm={handleAddAlerta} label="Reportar Problema" confirmColor="bg-red-500 hover:bg-red-600" submitting={alertaSubmitting} />
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        {children}
      </div>
    </div>
  );
}

function ModalButtons({ onCancel, onConfirm, label, confirmColor, submitting }: { onCancel: () => void; onConfirm: () => void; label: string; confirmColor?: string; submitting?: boolean }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm">Cancelar</button>
      <button onClick={onConfirm} disabled={submitting} className={`flex-1 text-white px-4 py-3 rounded-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed ${confirmColor || "bg-[#EF8022] hover:bg-[#d9711c]"}`}>{submitting ? "Guardando..." : label}</button>
    </div>
  );
}

// ── Calendar renderer ��─────────────────────────────────────────────────────

function renderCalendar(
  year: number, month: number,
  setYear: (fn: (y: number) => number) => void, setMonth: (fn: (m: number) => number) => void,
  map: Record<string, number>, maxCap: number,
  selectedDate: string | null, setSelectedDate: (d: string | null) => void,
  todayStr: string, subtitle?: string
) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => { if (month === 0) { setMonth(() => 11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(() => 0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
          Calendario de Disponibilidad
          {subtitle && <span className="text-sm text-[#EF8022] ml-2">— {subtitle}</span>}
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-gray-900 dark:text-white min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map(d => <div key={d} className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDate(new Date(year, month, day));
          const count = map[dateStr] || 0;
          const pct = maxCap ? count / maxCap : 0;
          const isToday = dateStr === todayStr;
          const isSel = dateStr === selectedDate;

          let bgClass = "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700";
          if (pct >= 1) bgClass = "bg-red-100 dark:bg-red-900/30 hover:bg-red-200";
          else if (pct >= 0.5) bgClass = "bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200";
          else if (count > 0) bgClass = "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100";

          return (
            <button key={day} onClick={() => setSelectedDate(isSel ? null : dateStr)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all relative ${bgClass} ${isSel ? "ring-2 ring-[#EF8022]" : ""} ${isToday ? "ring-2 ring-[#1F3C8B] dark:ring-blue-400" : ""}`}>
              <span className={`text-sm ${isToday ? "text-[#1F3C8B] dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>{day}</span>
              {count > 0 && <span className={`text-[10px] mt-0.5 ${pct >= 1 ? "text-red-600 dark:text-red-400" : pct >= 0.5 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}>{count} rsv</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"></div> Libre</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"></div> Parcial</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800"></div> {"> 50%"}</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800"></div> Agotado</div>
        <div className="flex items-center gap-1.5 ml-auto"><div className="w-3 h-3 rounded ring-2 ring-[#1F3C8B]"></div> Hoy</div>
      </div>
    </div>
  );
}

function renderFichasCalendar(
  year: number, month: number,
  setYear: (fn: (y: number) => number) => void, setMonth: (fn: (m: number) => number) => void,
  map: Record<string, number>,
  selectedDate: string | null, setSelectedDate: (d: string | null) => void,
  todayStr: string
) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => { if (month === 0) { setMonth(() => 11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(() => 0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
          Calendario de Fichas
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-gray-900 dark:text-white min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map(d => <div key={d} className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDate(new Date(year, month, day));
          const count = map[dateStr] || 0;
          const isToday = dateStr === todayStr;
          const isSel = dateStr === selectedDate;

          const bgClass = count > 0
            ? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100"
            : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700";

          return (
            <button key={day} onClick={() => setSelectedDate(isSel ? null : dateStr)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all relative ${bgClass} ${isSel ? "ring-2 ring-[#EF8022]" : ""} ${isToday ? "ring-2 ring-[#1F3C8B] dark:ring-blue-400" : ""}`}>
              <span className={`text-sm ${isToday ? "text-[#1F3C8B] dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>{day}</span>
              {count > 0 && <span className="text-[10px] mt-0.5 text-blue-600 dark:text-blue-400">{count} ficha{count !== 1 ? "s" : ""}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"></div> Sin fichas</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"></div> Con fichas</div>
        <div className="flex items-center gap-1.5 ml-auto"><div className="w-3 h-3 rounded ring-2 ring-[#1F3C8B]"></div> Hoy</div>
      </div>
    </div>
  );
}
