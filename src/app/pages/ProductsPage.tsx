import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Package, Plus, Filter, X, Layers, Trash2, ChevronDown, ChevronLeft, ChevronRight, Check, ShoppingCart, History, Users, Pencil } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { useProducts } from "../contexts/ProductsContext";
import type { PaqueteItem, Paquete, FlatProduct, Carrito, Recurso, RecursoStockMovement, Personal } from "../contexts/ProductsContext";
import { apiRequest } from "../lib/api";
import { useBrand } from "../contexts/BrandContext";

const ITEMS_PER_PAGE = 15;

type CarritoTipo = { id: number; nombre: string };

type CalendarFicha = {
  id: number;
  fecha: string;
  fechaEvento: string;
  clienteNombre: string;
  distrito: string;
  horaEntrega: string;
  horaRecojo: string;
  personalIds: number[];
  carritoIds: number[];
};

type CalendarEntry = {
  fichaId: number;
  clienteNombre: string;
  distrito: string;
  horaEntrega: string;
  horaRecojo: string;
  personalCount: number;
  carritoCount: number;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatCalendarDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDateString(dateStr: string | undefined): string {
  if (!dateStr) return "";
  // Remove time portion if present (e.g., "2026-05-14T00:00:00" -> "2026-05-14")
  return dateStr.split("T")[0];
}

const DAY_HEADERS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

// ── Product selector dropdown ────────────────────────────────────

function ProductSelector({
  allProducts,
  selectedSku,
  onSelect,
}: {
  allProducts: FlatProduct[];
  selectedSku: string;
  onSelect: (sku: string, nombre: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = allProducts.filter(
    (p) =>
      p.producto.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = allProducts.find((p) => p.sku === selectedSku);

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8022] text-left"
      >
        <span className={selectedProduct ? "" : "text-gray-400"}>
          {selectedProduct
            ? `${selectedProduct.producto}`
            : "Seleccionar producto..."}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          <div className="sticky top-0 bg-white dark:bg-gray-700 p-2 border-b border-gray-100 dark:border-gray-600">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-500 rounded bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#EF8022]"
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-400 text-center">Sin resultados</div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.sku}
                type="button"
                onClick={() => {
                  onSelect(p.sku, p.producto);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 ${
                  p.sku === selectedSku ? "bg-[#EF8022]/10" : ""
                }`}
              >
                {p.sku === selectedSku && <Check className="w-3 h-3 text-[#EF8022] shrink-0" />}
                <div className="min-w-0">
                  <span className="text-gray-900 dark:text-white">{p.producto}</span>
                </div>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">{p.categoria}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"productos" | "paquetes" | "carritos" | "recursos" | "personal">("productos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [currentPage, setCurrentPage] = useState(1);
  const { brand } = useBrand();

  // ← shared context instead of local state
  const {
    categories,
    allProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    deleteCategory,
    recursos,
    addRecurso,
    updateRecursoStock,
    getRecursoStockMovements,
    deleteRecurso,
    paquetes,
    addPaquete,
    updatePaquete,
    deletePaquete,
    carritos,
    addCarrito,
    updateCarrito,
    updateCarritoEstado,
    deleteCarrito,
    personales,
    addPersonal,
    updatePersonal,
    deletePersonal,
  } = useProducts();

  // Product modal
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FlatProduct | null>(null);
  const [productFormSubmitting, setProductFormSubmitting] = useState(false);
  const [newProduct, setNewProduct] = useState({
    categoria: "",
    nuevaCategoria: "",
    producto: "",
    sku: "",
    precio: 0,
  });

  // Package modal
  const [showAddPaquete, setShowAddPaquete] = useState(false);
  const [editingPaquete, setEditingPaquete] = useState<Paquete | null>(null);
  const [paqueteFormErrors, setPaqueteFormErrors] = useState({ nombre: false });
  const [paqueteFormSubmitting, setPaqueteFormSubmitting] = useState(false);
  const [newPaquete, setNewPaquete] = useState({
    nombre: "",
    precioUnitario: 0,
    precioEditadoManualmente: false,
    contenidoItems: [{ productoSku: "", productoNombre: "", cantidad: 0 }] as PaqueteItem[],
  });

  // Carrito modal
  const [showAddCarrito, setShowAddCarrito] = useState(false);
  const [carritoFormSubmitting, setCarritoFormSubmitting] = useState(false);
  const [newCarrito, setNewCarrito] = useState({
    modelo: "",
    codigo: "",
    tipoId: 0,
    descripcion: "",
    estado: "disponible" as Carrito["estado"],
  });
  const [showEditCarrito, setShowEditCarrito] = useState(false);
  const [editingCarritoId, setEditingCarritoId] = useState<number | null>(null);
  const [editCarritoForm, setEditCarritoForm] = useState({
    modelo: "",
    codigo: "",
    tipoId: 0,
    descripcion: "",
    estado: "disponible" as Carrito["estado"],
  });
  const [editCarritoSubmitting, setEditCarritoSubmitting] = useState(false);

  // Tipos de carrito
  const [carritoTipos, setCarritoTipos] = useState<CarritoTipo[]>([]);
  const [carritoTiposLoading, setCarritoTiposLoading] = useState(false);
  const [showNuevoTipoInput, setShowNuevoTipoInput] = useState(false);
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState("");
  const [nuevoTipoSubmitting, setNuevoTipoSubmitting] = useState(false);

  // Personal modal
  const emptyPersonalForm = {
    nombre_completo: "",
    dni: "",
    fecha_nacimiento: "",
    numero_telefono: "",
    rol: "apoyo" as Personal["rol"],
    estado: "disponible" as Personal["estado"],
    foto_url: "",
  };
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState<Personal | null>(null);
  const [personalForm, setPersonalForm] = useState(emptyPersonalForm);
  const [personalFormError, setPersonalFormError] = useState("");
  const [personalFormSubmitting, setPersonalFormSubmitting] = useState(false);
  const [personalSearch, setPersonalSearch] = useState("");
  const [fichasCalendario, setFichasCalendario] = useState<CalendarFicha[]>([]);
  const [personalCalendarMonth, setPersonalCalendarMonth] = useState(new Date().getMonth());
  const [personalCalendarYear, setPersonalCalendarYear] = useState(new Date().getFullYear());
  const [selectedPersonalCalendarId, setSelectedPersonalCalendarId] = useState(0);
  const [selectedPersonalCalendarDate, setSelectedPersonalCalendarDate] = useState<string | null>(null);
  const [carritoCalendarMonth, setCarritoCalendarMonth] = useState(new Date().getMonth());
  const [carritoCalendarYear, setCarritoCalendarYear] = useState(new Date().getFullYear());
  const [selectedCarritoCalendarId, setSelectedCarritoCalendarId] = useState(0);
  const [selectedCarritoCalendarDate, setSelectedCarritoCalendarDate] = useState<string | null>(null);
  const [showCarritoCalendarDayModal, setShowCarritoCalendarDayModal] = useState(false);
  const [selectedCarritoCalendarDayDate, setSelectedCarritoCalendarDayDate] = useState<string | null>(null);
  const [carritoCalendarLoading, setCarritoCalendarLoading] = useState(false);
  const [carritoCalendarError, setCarritoCalendarError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogSubmitting, setDeleteDialogSubmitting] = useState(false);
  const [deleteDialogError, setDeleteDialogError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "product"; product: FlatProduct }
    | { kind: "category"; categoryId: number; categoryName: string; productCount: number }
    | { kind: "paquete"; paquete: Paquete }
    | { kind: "carrito"; carrito: Carrito }
    | { kind: "recurso"; recurso: Recurso }
    | { kind: "personal"; personal: Personal }
    | null
  >(null);
  const [showPersonalCalendarDayModal, setShowPersonalCalendarDayModal] = useState(false);
  const [selectedPersonalCalendarDayDate, setSelectedPersonalCalendarDayDate] = useState<string | null>(null);
  const [personalCalendarLoading, setPersonalCalendarLoading] = useState(false);
  const [personalCalendarError, setPersonalCalendarError] = useState("");
  const formLocksRef = useRef({ product: false, paquete: false, carrito: false });

  const validatePhone = (phone: string, role: Personal["rol"]): boolean => {
    const trimmed = phone.trim();
    if (!trimmed) return false;

    if (role === "chofer") {
      if (!/^[+\d\s-]+$/.test(trimmed)) return false;
      const digits = trimmed.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }

    const stripped = trimmed.replace(/[\s\-]/g, "");
    return /^(\+\d{1,4})?\d{9}$/.test(stripped);
  };

  const validatePersonalForm = (form: typeof personalForm): string => {
    if (form.nombre_completo.trim().length < 3) return "El nombre completo debe tener al menos 3 caracteres.";
    if (!/^\d{8}$/.test(form.dni)) return "El DNI debe ser exactamente 8 dígitos numéricos.";

    if (!form.fecha_nacimiento) return "La fecha de nacimiento es requerida.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha_nacimiento)) return "La fecha debe estar en formato YYYY-MM-DD.";
    if (new Date(form.fecha_nacimiento) > new Date()) return "La fecha de nacimiento no puede ser futura.";
    if (!validatePhone(form.numero_telefono, "apoyo")) return "Teléfono inválido. Ej: +51987654321, 987654321, 987-654-321.";
    return "";
  };

  const openAddPersonal = () => {
    setEditingPersonal(null);
    setPersonalForm(emptyPersonalForm);
    setPersonalFormError("");
    setShowPersonalModal(true);
  };

  const openEditPersonal = (p: Personal) => {
    if (p.rol === "chofer") {
      setPersonalFormError("Los choferes se editan en la página de Logística.");
      return;
    }

    setEditingPersonal(p);
    setPersonalForm({
      nombre_completo: p.nombre_completo,
      dni: p.dni,
      fecha_nacimiento: p.fecha_nacimiento,
      numero_telefono: p.numero_telefono,
      rol: "apoyo",
      estado: p.estado,
      foto_url: p.foto_url ?? "",
    });
    setPersonalFormError("");
    setShowPersonalModal(true);
  };

  const handleSubmitPersonal = async () => {
    if (editingPersonal?.rol === "chofer") {
      setPersonalFormError("Los choferes se editan en la página de Logística.");
      return;
    }

    const error = validatePersonalForm(personalForm);
    if (error) { setPersonalFormError(error); return; }
    setPersonalFormSubmitting(true);
    setPersonalFormError("");
    try {
      const payload = {
        nombre_completo: personalForm.nombre_completo.trim(),
        dni: personalForm.dni.trim(),
        fecha_nacimiento: personalForm.fecha_nacimiento,
        numero_telefono: personalForm.numero_telefono.trim(),
        rol: "apoyo" as const,
        estado: personalForm.estado,
        ...(personalForm.foto_url.trim() ? { foto_url: personalForm.foto_url.trim() } : {}),
      };

      if (editingPersonal) {
        await updatePersonal(editingPersonal.id, payload, editingPersonal.rol);
      } else {
        await addPersonal(payload);
      }
      setShowPersonalModal(false);
      setPersonalForm(emptyPersonalForm);
      setEditingPersonal(null);
    } catch (err) {
      setPersonalFormError(err instanceof Error ? err.message : "No se pudo guardar. Verifica los datos.");
    } finally {
      setPersonalFormSubmitting(false);
    }
  };

  const handleDeletePersonal = async (p: Personal) => {
    setDeleteTarget({ kind: "personal", personal: p });
    setDeleteDialogError("");
    setDeleteDialogOpen(true);
  };

  const filteredPersonales = personales.filter((p) =>
    p.nombre_completo.toLowerCase().includes(personalSearch.toLowerCase()) ||
    p.dni.includes(personalSearch) ||
    p.rol.includes(personalSearch)
  );

  const estadoPersonalColor: Record<Personal["estado"], string> = {
    disponible: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    ocupado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    descanso: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };

  const selectedPersonalCalendar = selectedPersonalCalendarId > 0
    ? personales.find((p) => p.id === selectedPersonalCalendarId) || null
    : null;

  // Calcular estado dinámico del personal basado en eventos asignados (solo HOY)
  const getDynamicPersonalEstado = (personalId: number): Personal["estado"] => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD de hoy
    const hasEventsToday = fichasCalendario.some(
      (ficha) => ficha.personalIds.includes(personalId) && 
      normalizeDateString(ficha.fechaEvento || ficha.fecha) === today
    );
    if (hasEventsToday) return "ocupado";
    
    const personal = personales.find((p) => p.id === personalId);
    return personal?.estado || "disponible";
  };

  const personalCalendarEvents = useMemo(() => {
    return fichasCalendario
      .filter((ficha) => selectedPersonalCalendarId === 0 || ficha.personalIds.includes(selectedPersonalCalendarId))
      .sort((a, b) => a.fechaEvento.localeCompare(b.fechaEvento));
  }, [fichasCalendario, selectedPersonalCalendarId]);

  const personalCalendarByDate = useMemo(() => {
    return personalCalendarEvents.reduce<Record<string, CalendarEntry[]>>((acc, ficha) => {
      const dateKey = ficha.fechaEvento;
      if (!dateKey) return acc;

      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push({
        fichaId: ficha.id,
        clienteNombre: ficha.clienteNombre,
        distrito: ficha.distrito,
        horaEntrega: ficha.horaEntrega,
        horaRecojo: ficha.horaRecojo,
        personalCount: ficha.personalIds.length,
        carritoCount: ficha.carritoIds.length,
      });
      return acc;
    }, {});
  }, [personalCalendarEvents]);

  const selectedPersonalCalendarDateEvents = selectedPersonalCalendarDate
    ? personalCalendarByDate[selectedPersonalCalendarDate] || []
    : [];

  const personalCalendarMonthLabel = new Date(personalCalendarYear, personalCalendarMonth, 1).toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  const personalCalendarToday = new Date().toISOString().split("T")[0];

  const goToPreviousPersonalCalendarMonth = () => {
    setSelectedPersonalCalendarDate(null);
    setPersonalCalendarMonth((month) => {
      if (month === 0) {
        setPersonalCalendarYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  };

  const goToNextPersonalCalendarMonth = () => {
    setSelectedPersonalCalendarDate(null);
    setPersonalCalendarMonth((month) => {
      if (month === 11) {
        setPersonalCalendarYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  };

  // ── Carrito calendar computed values ────────────────────────────

  const selectedCarritoCalendar = selectedCarritoCalendarId > 0
    ? carritos.find((c) => c.id === selectedCarritoCalendarId) || null
    : null;

  const getDynamicCarritoEstadoCalendar = (carritoId: number): "disponible" | "ocupado" => {
    const today = new Date().toISOString().split("T")[0];
    const busyToday = fichasCalendario.some(
      (f) => f.carritoIds.includes(carritoId) && normalizeDateString(f.fechaEvento || f.fecha) === today
    );
    return busyToday ? "ocupado" : "disponible";
  };

  const carritoCalendarEvents = useMemo(() => {
    return fichasCalendario
      .filter((f) =>
        selectedCarritoCalendarId === 0
          ? f.carritoIds.length > 0
          : f.carritoIds.includes(selectedCarritoCalendarId)
      )
      .sort((a, b) => a.fechaEvento.localeCompare(b.fechaEvento));
  }, [fichasCalendario, selectedCarritoCalendarId]);

  const carritoCalendarByDate = useMemo(() => {
    return carritoCalendarEvents.reduce<Record<string, CalendarEntry[]>>((acc, ficha) => {
      const dateKey = ficha.fechaEvento;
      if (!dateKey) return acc;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push({
        fichaId: ficha.id,
        clienteNombre: ficha.clienteNombre,
        distrito: ficha.distrito,
        horaEntrega: ficha.horaEntrega,
        horaRecojo: ficha.horaRecojo,
        personalCount: ficha.personalIds.length,
        carritoCount: ficha.carritoIds.length,
      });
      return acc;
    }, {});
  }, [carritoCalendarEvents]);

  const selectedCarritoCalendarDateEvents = selectedCarritoCalendarDate
    ? carritoCalendarByDate[selectedCarritoCalendarDate] || []
    : [];

  const carritoCalendarMonthLabel = new Date(carritoCalendarYear, carritoCalendarMonth, 1).toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  const carritoCalendarToday = new Date().toISOString().split("T")[0];

  const goToPreviousCarritoCalendarMonth = () => {
    setSelectedCarritoCalendarDate(null);
    setCarritoCalendarMonth((month) => {
      if (month === 0) {
        setCarritoCalendarYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  };

  const goToNextCarritoCalendarMonth = () => {
    setSelectedCarritoCalendarDate(null);
    setCarritoCalendarMonth((month) => {
      if (month === 11) {
        setCarritoCalendarYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  };

  const loadCarritoCalendarData = async () => {
    if (!brand) return;
    setCarritoCalendarLoading(true);
    setCarritoCalendarError("");
    try {
      const list = await apiRequest<Array<{ id: number }>>(`/fichas?brand=${brand}`);
      const details = await Promise.all(list.map((item) => apiRequest<any>(`/fichas/${item.id}`)));
      const mapped: CalendarFicha[] = details.map((f) => {
        const fechaNormalizada = normalizeDateString(f.fecha_evento || f.fecha);
        return {
          id: f.id,
          fecha: fechaNormalizada,
          fechaEvento: fechaNormalizada,
          clienteNombre: f.cliente_nombre || "",
          distrito: f.distrito || "",
          horaEntrega: f.hora_entrega || "",
          horaRecojo: f.hora_recojo || "",
          personalIds: Array.isArray(f.personalIds) ? f.personalIds : [],
          carritoIds: Array.isArray(f.carritoIds) ? f.carritoIds : [],
        };
      });
      setFichasCalendario(mapped);
    } catch (err) {
      setCarritoCalendarError(err instanceof Error ? err.message : "No se pudo cargar el calendario de carritos");
    } finally {
      setCarritoCalendarLoading(false);
    }
  };

  const loadPersonalCalendarData = async () => {
    if (!brand) return;

    setPersonalCalendarLoading(true);
    setPersonalCalendarError("");

    try {
      const list = await apiRequest<Array<{ id: number }>>(`/fichas?brand=${brand}`);
      const details = await Promise.all(list.map((item) => apiRequest<any>(`/fichas/${item.id}`)));

      const mapped: CalendarFicha[] = details.map((f) => {
        const fechaNormalizada = normalizeDateString(f.fecha_evento || f.fecha);
        const personalIds = Array.isArray(f.personalIds) ? f.personalIds : [];
        const carritoIds = Array.isArray(f.carritoIds) ? f.carritoIds : [];

        return {
          id: f.id,
          fecha: fechaNormalizada,
          fechaEvento: fechaNormalizada,
          clienteNombre: f.cliente_nombre || "",
          distrito: f.distrito || "",
          horaEntrega: f.hora_entrega || "",
          horaRecojo: f.hora_recojo || "",
          personalIds,
          carritoIds,
        };
      });

      setFichasCalendario(mapped);
    } catch (err) {
      setPersonalCalendarError(err instanceof Error ? err.message : "No se pudo cargar el calendario del personal");
      setFichasCalendario([]);
    } finally {
      setPersonalCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "personal") return;
    void loadPersonalCalendarData();
  }, [activeTab, brand]);

  useEffect(() => {
    if (activeTab !== "carritos") return;
    void loadCarritoCalendarData();
    void loadCarritoTipos();
  }, [activeTab, brand]);

  useEffect(() => {
    if (selectedPersonalCalendarId > 0 && !personales.some((p) => p.id === selectedPersonalCalendarId)) {
      setSelectedPersonalCalendarId(0);
    }
  }, [personales, selectedPersonalCalendarId]);

  // Recurso modal state
  const emptyRecursoForm = {
    recurso: "",
    sku: "",
    precio: 0,
    brand: "donofrio" as Recurso["brand"],
    stockActual: 0,
    stockMinimo: 0,
  };
  const [showRecursoModal, setShowRecursoModal] = useState(false);
  const [recursoForm, setRecursoForm] = useState(emptyRecursoForm);
  const [recursoFormError, setRecursoFormError] = useState("");
  const [recursoFormSubmitting, setRecursoFormSubmitting] = useState(false);

  // Recurso stock state
  const [selectedRecurso, setSelectedRecurso] = useState<Recurso | null>(null);
  const [showRecursoStockMovementModal, setShowRecursoStockMovementModal] = useState(false);
  const [recursoStockMovementType, setRecursoStockMovementType] = useState<"entrada" | "salida">("entrada");
  const [recursoStockMovementForm, setRecursoStockMovementForm] = useState({
    cantidad: 1,
    motivo: "",
    submitting: false,
    error: "",
  });
  const [showRecursoStockAdjustmentModal, setShowRecursoStockAdjustmentModal] = useState(false);
  const [recursoStockAdjustmentForm, setRecursoStockAdjustmentForm] = useState({
    stockActual: 0,
    stockMinimo: 0,
    motivo: "",
    submitting: false,
    error: "",
  });
  const [showRecursoStockHistoryModal, setShowRecursoStockHistoryModal] = useState(false);
  const [recursoStockHistoryState, setRecursoStockHistoryState] = useState<{
    loading: boolean;
    error: string;
    movements: RecursoStockMovement[];
  }>({ loading: false, error: "", movements: [] });

  // Filter products
  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch =
      product.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Todas" || product.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter paquetes
  const filteredPaquetes = paquetes.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const displayItems = activeTab === "productos" ? filteredProducts : filteredPaquetes;
  const totalPages = Math.ceil(displayItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const filteredCarritos = carritos.filter(
    (c) =>
      c.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const categoryNames = ["Todas", ...categories.map((cat) => cat.categoria)];

  const getPrecioPaqueteCalculado = (items: PaqueteItem[]) => {
    return items.reduce((total, item) => {
      if (!item.productoSku || item.cantidad <= 0) return total;
      const producto = allProducts.find((p) => p.sku === item.productoSku);
      const precioProducto = Number(producto?.precio || 0);
      return total + (precioProducto * item.cantidad);
    }, 0);
  };

  const updatePaqueteItems = (items: PaqueteItem[]) => {
    const precioCalculado = Number(getPrecioPaqueteCalculado(items).toFixed(2));
    setNewPaquete((prev) => ({
      ...prev,
      contenidoItems: items,
      ...(prev.precioEditadoManualmente ? {} : { precioUnitario: precioCalculado }),
    }));
  };

  // Add/Update product via context
  const handleSaveProduct = async () => {
    if (!newProduct.producto || !newProduct.sku) return;
    const catName = newProduct.nuevaCategoria || newProduct.categoria;
    if (!catName) return;
    if (formLocksRef.current.product || productFormSubmitting) return;

    formLocksRef.current.product = true;
    setProductFormSubmitting(true);

    try {
      const payload = {
        producto: newProduct.producto,
        sku: newProduct.sku,
        precio: Number(newProduct.precio || 0),
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, catName, payload);
      } else {
        await addProduct(catName, payload);
      }

      setShowAddProduct(false);
      setEditingProduct(null);
      setNewProduct({
        categoria: "",
        nuevaCategoria: "",
        producto: "",
        sku: "",
        precio: 0,
      });
    } finally {
      formLocksRef.current.product = false;
      setProductFormSubmitting(false);
    }
  };

  const closePaqueteModal = () => {
    setShowAddPaquete(false);
    setEditingPaquete(null);
    setPaqueteFormErrors({ nombre: false });
    setNewPaquete({
      nombre: "",
      precioUnitario: 0,
      precioEditadoManualmente: false,
      contenidoItems: [{ productoSku: "", productoNombre: "", cantidad: 0 }],
    });
  };

  const handleEditPaquete = (paq: Paquete) => {
    setEditingPaquete(paq);
    setNewPaquete({
      nombre: paq.nombre,
      precioUnitario: paq.precioUnitario,
      precioEditadoManualmente: true,
      contenidoItems: paq.contenido.length > 0
        ? paq.contenido
        : [{ productoSku: "", productoNombre: "", cantidad: 0 }],
    });
    setPaqueteFormErrors({ nombre: false });
    setShowAddPaquete(true);
  };

  // Add/Edit paquete via context
  const handleSavePaquete = async () => {
    if (!newPaquete.nombre.trim()) {
      setPaqueteFormErrors({ nombre: true });
      return;
    }
    if (formLocksRef.current.paquete || paqueteFormSubmitting) return;

    formLocksRef.current.paquete = true;
    setPaqueteFormSubmitting(true);
    setPaqueteFormErrors({ nombre: false });
    try {
      const contenidoValido = newPaquete.contenidoItems.filter((i) => i.productoSku && i.cantidad > 0);
      const precioTotalCalculado = Number(getPrecioPaqueteCalculado(contenidoValido).toFixed(2));
      const payload = {
        nombre: newPaquete.nombre.trim(),
        precioUnitario: Number((newPaquete.precioUnitario || precioTotalCalculado).toFixed(2)),
        contenido: contenidoValido,
      };

      if (editingPaquete) {
        await updatePaquete(editingPaquete.id, payload);
      } else {
        await addPaquete(payload);
      }
      closePaqueteModal();
    } finally {
      formLocksRef.current.paquete = false;
      setPaqueteFormSubmitting(false);
    }
  };

  const contenidoPaqueteValido = newPaquete.contenidoItems.filter((item) => item.productoSku && item.cantidad > 0);
  const precioTotalPaquete = getPrecioPaqueteCalculado(contenidoPaqueteValido);

  const handleEditProduct = (product: FlatProduct) => {
    setEditingProduct(product);
    setNewProduct({
      categoria: product.categoria,
      nuevaCategoria: "",
      producto: product.producto,
      sku: product.sku,
      precio: product.precio,
    });
    setShowAddProduct(true);
  };

  const loadCarritoTipos = async () => {
    setCarritoTiposLoading(true);
    try {
      const data = await apiRequest<CarritoTipo[]>("/carritos/tipos");
      setCarritoTipos(data);
    } finally {
      setCarritoTiposLoading(false);
    }
  };

  const handleAddNuevoTipo = async (targetForm: "add" | "edit") => {
    const nombre = nuevoTipoNombre.trim();
    if (!nombre || nuevoTipoSubmitting) return;
    setNuevoTipoSubmitting(true);
    try {
      const created = await apiRequest<CarritoTipo>("/carritos/tipos", {
        method: "POST",
        body: JSON.stringify({ nombre }),
      });
      setCarritoTipos((prev) => [...prev, created]);
      if (targetForm === "add") {
        setNewCarrito((prev) => ({ ...prev, tipoId: created.id }));
      } else {
        setEditCarritoForm((prev) => ({ ...prev, tipoId: created.id }));
      }
      setNuevoTipoNombre("");
      setShowNuevoTipoInput(false);
    } finally {
      setNuevoTipoSubmitting(false);
    }
  };

  const handleAddCarrito = async () => {
    const codigo = newCarrito.codigo.trim();
    const modelo = newCarrito.modelo.trim();
    if (!codigo || !modelo || newCarrito.tipoId === 0) return;
    if (formLocksRef.current.carrito || carritoFormSubmitting) return;

    formLocksRef.current.carrito = true;
    setCarritoFormSubmitting(true);

    try {
      await addCarrito({
        modelo,
        codigo,
        tipoId: newCarrito.tipoId,
        tipoNombre: carritoTipos.find((t) => t.id === newCarrito.tipoId)?.nombre ?? "",
        descripcion: newCarrito.descripcion.trim(),
        estado: newCarrito.estado,
      });

      setShowAddCarrito(false);
      setNewCarrito({ modelo: "", codigo: "", tipoId: 0, descripcion: "", estado: "disponible" });
    } finally {
      formLocksRef.current.carrito = false;
      setCarritoFormSubmitting(false);
    }
  };

  const handleOpenEditCarrito = async (carrito: Carrito) => {
    setEditingCarritoId(carrito.id);
    setEditCarritoForm({
      modelo: carrito.modelo,
      codigo: carrito.codigo,
      tipoId: carrito.tipoId,
      descripcion: carrito.descripcion,
      estado: carrito.estado,
    });
    if (carritoTipos.length === 0) await loadCarritoTipos();
    setShowNuevoTipoInput(false);
    setNuevoTipoNombre("");
    setShowEditCarrito(true);
  };

  const handleSaveEditCarrito = async () => {
    if (editingCarritoId === null) return;
    const codigo = editCarritoForm.codigo.trim();
    const modelo = editCarritoForm.modelo.trim();
    if (!codigo || !modelo || editCarritoForm.tipoId === 0) return;
    if (editCarritoSubmitting) return;

    setEditCarritoSubmitting(true);
    try {
      await updateCarrito(editingCarritoId, {
        modelo,
        codigo,
        tipoId: editCarritoForm.tipoId,
        tipoNombre: carritoTipos.find((t) => t.id === editCarritoForm.tipoId)?.nombre ?? "",
        descripcion: editCarritoForm.descripcion.trim(),
        estado: editCarritoForm.estado,
      });
      setShowEditCarrito(false);
      setEditingCarritoId(null);
    } finally {
      setEditCarritoSubmitting(false);
    }
  };

  const getTotalHelados = (contenido: PaqueteItem[]) =>
    contenido.reduce((s, i) => s + i.cantidad, 0);

  const handleDeleteProduct = async (product: FlatProduct) => {
    setDeleteTarget({ kind: "product", product });
    setDeleteDialogError("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteCategory = async (categoryId: number, categoryName: string, productCount: number) => {
    setDeleteTarget({ kind: "category", categoryId, categoryName, productCount });
    setDeleteDialogError("");
    setDeleteDialogOpen(true);
  };

  const handleRecursoStockAdjustment = (recurso: Recurso) => {
    setSelectedRecurso(recurso);
    setRecursoStockAdjustmentForm({
      stockActual: recurso.stockActual,
      stockMinimo: recurso.stockMinimo,
      motivo: "Conteo fisico",
      submitting: false,
      error: "",
    });
    setShowRecursoStockAdjustmentModal(true);
  };

  const handleRecursoStockMovement = (recurso: Recurso, tipo: "entrada" | "salida") => {
    setSelectedRecurso(recurso);
    setRecursoStockMovementType(tipo);
    setRecursoStockMovementForm({
      cantidad: 1,
      motivo: tipo === "entrada" ? "Reposición" : "Uso en evento",
      submitting: false,
      error: "",
    });
    setShowRecursoStockMovementModal(true);
  };

  const handleShowRecursoStockMovements = async (recurso: Recurso) => {
    setSelectedRecurso(recurso);
    setShowRecursoStockHistoryModal(true);
    setRecursoStockHistoryState({ loading: true, error: "", movements: [] });
    try {
      const movements = await getRecursoStockMovements(recurso.id);
      setRecursoStockHistoryState({ loading: false, error: "", movements });
    } catch (error) {
      setRecursoStockHistoryState({
        loading: false,
        error: error instanceof Error ? error.message : "No se pudo cargar el historial.",
        movements: [],
      });
    }
  };

  const submitRecursoStockMovement = async () => {
    if (!selectedRecurso) return;
    if (!Number.isFinite(recursoStockMovementForm.cantidad) || recursoStockMovementForm.cantidad <= 0) {
      setRecursoStockMovementForm((prev) => ({ ...prev, error: "La cantidad debe ser mayor a 0." }));
      return;
    }
    if (!recursoStockMovementForm.motivo.trim()) {
      setRecursoStockMovementForm((prev) => ({ ...prev, error: "El motivo es obligatorio." }));
      return;
    }
    setRecursoStockMovementForm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await updateRecursoStock(selectedRecurso.id, {
        stockActual: recursoStockMovementType === "entrada"
          ? selectedRecurso.stockActual + recursoStockMovementForm.cantidad
          : Math.max(0, selectedRecurso.stockActual - recursoStockMovementForm.cantidad),
        motivo: recursoStockMovementForm.motivo.trim(),
      });
      setShowRecursoStockMovementModal(false);
    } catch (error) {
      setRecursoStockMovementForm((prev) => ({
        ...prev,
        submitting: false,
        error: error instanceof Error ? error.message : "No se pudo registrar el movimiento.",
      }));
      return;
    }
    setRecursoStockMovementForm((prev) => ({ ...prev, submitting: false }));
  };

  const submitRecursoStockAdjustment = async () => {
    if (!selectedRecurso) return;
    if (!Number.isFinite(recursoStockAdjustmentForm.stockActual) || recursoStockAdjustmentForm.stockActual < 0) {
      setRecursoStockAdjustmentForm((prev) => ({ ...prev, error: "El stock actual debe ser mayor o igual a 0." }));
      return;
    }
    if (!Number.isFinite(recursoStockAdjustmentForm.stockMinimo) || recursoStockAdjustmentForm.stockMinimo < 0) {
      setRecursoStockAdjustmentForm((prev) => ({ ...prev, error: "El stock mínimo debe ser mayor o igual a 0." }));
      return;
    }
    setRecursoStockAdjustmentForm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await updateRecursoStock(selectedRecurso.id, {
        stockActual: recursoStockAdjustmentForm.stockActual,
        stockMinimo: recursoStockAdjustmentForm.stockMinimo,
        motivo: recursoStockAdjustmentForm.motivo.trim(),
      });
      setShowRecursoStockAdjustmentModal(false);
    } catch (error) {
      setRecursoStockAdjustmentForm((prev) => ({
        ...prev,
        submitting: false,
        error: error instanceof Error ? error.message : "No se pudo ajustar el stock.",
      }));
      return;
    }
    setRecursoStockAdjustmentForm((prev) => ({ ...prev, submitting: false }));
  };

  const handleSaveRecurso = async () => {
    if (!recursoForm.recurso.trim() || !recursoForm.sku.trim()) {
      setRecursoFormError("El nombre y SKU son obligatorios.");
      return;
    }
    setRecursoFormError("");
    setRecursoFormSubmitting(true);
    try {
      await addRecurso({
        recurso: recursoForm.recurso.trim(),
        sku: recursoForm.sku.trim(),
        precio: Number(recursoForm.precio || 0),
        brand: recursoForm.brand,
        stockActual: Number(recursoForm.stockActual || 0),
        stockMinimo: Number(recursoForm.stockMinimo || 0),
      });
      setShowRecursoModal(false);
      setRecursoForm(emptyRecursoForm);
    } catch (err) {
      setRecursoFormError(err instanceof Error ? err.message : "No se pudo guardar el recurso.");
    } finally {
      setRecursoFormSubmitting(false);
    }
  };

  const handleDeleteRecurso = async (r: Recurso) => {
    setDeleteTarget({ kind: "recurso", recurso: r });
    setDeleteDialogError("");
    setDeleteDialogOpen(true);
  };

  const handleDeletePaquete = async (paquete: Paquete) => {
    setDeleteTarget({ kind: "paquete", paquete });
    setDeleteDialogError("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteCarrito = async (carrito: Carrito) => {
    setDeleteTarget({ kind: "carrito", carrito });
    setDeleteDialogError("");
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) return;

    setDeleteDialogSubmitting(true);
    setDeleteDialogError("");

    try {
      switch (deleteTarget.kind) {
        case "product":
          await deleteProduct(deleteTarget.product.id);
          break;
        case "category":
          await deleteCategory(deleteTarget.categoryId);
          break;
        case "paquete":
          await deletePaquete(deleteTarget.paquete.id);
          break;
        case "carrito":
          await deleteCarrito(deleteTarget.carrito.id);
          break;
        case "recurso":
          await deleteRecurso(deleteTarget.recurso.id);
          break;
        case "personal":
          await deletePersonal(deleteTarget.personal.id);
          break;
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteDialogError(error instanceof Error ? error.message : "No se pudo eliminar el elemento.");
    } finally {
      setDeleteDialogSubmitting(false);
    }
  };



  return (
    <div className="p-4 sm:p-6 md:p-8">
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteDialogSubmitting(false);
          }
        }}
        title={
          deleteTarget?.kind === "category"
            ? `Eliminar categoría ${deleteTarget.categoryName}`
            : deleteTarget?.kind === "product"
              ? `Eliminar producto ${deleteTarget.product.producto}`
              : deleteTarget?.kind === "paquete"
                ? `Eliminar paquete ${deleteTarget.paquete.nombre}`
                : deleteTarget?.kind === "carrito"
                  ? `Eliminar carrito ${deleteTarget.carrito.codigo}`
                  : deleteTarget?.kind === "recurso"
                    ? `Eliminar recurso ${deleteTarget.recurso.recurso}`
                    : deleteTarget?.kind === "personal"
                      ? `Eliminar a ${deleteTarget.personal.nombre_completo}`
                      : "Eliminar elemento"
        }
        description={
          deleteTarget?.kind === "category"
            ? `¿Seguro que quieres eliminar esta categoría?${deleteTarget.productCount > 0 ? ` También se eliminarán sus ${deleteTarget.productCount} productos.` : ""} Esta acción no se puede deshacer.`
            : deleteTarget?.kind === "product"
              ? "¿Seguro que quieres eliminar este producto? Esta acción no se puede deshacer."
              : deleteTarget?.kind === "paquete"
                ? "¿Seguro que quieres eliminar este paquete? Esta acción no se puede deshacer."
                : deleteTarget?.kind === "carrito"
                  ? "¿Seguro que quieres eliminar este carrito? Esta acción no se puede deshacer."
                  : deleteTarget?.kind === "recurso"
                    ? "¿Seguro que quieres eliminar este recurso? Esta acción no se puede deshacer."
                    : deleteTarget?.kind === "personal"
                      ? "¿Seguro que quieres eliminar a esta persona? Esta acción no se puede deshacer."
                      : "¿Seguro que quieres eliminar este elemento? Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar"
        loadingLabel="Eliminando..."
        loading={deleteDialogSubmitting}
        onConfirm={confirmDeleteTarget}
      />
      {deleteDialogError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {deleteDialogError}
        </div>
      ) : null}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Catálogo de Productos</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona productos, stock, paquetes y carritos para eventos
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 md:mb-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
        <button
          onClick={() => { setActiveTab("productos"); setCurrentPage(1); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors text-sm ${
            activeTab === "productos"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Package className="w-4 h-4" />
          Productos Individuales
        </button>
        <button
          onClick={() => { setActiveTab("paquetes"); setCurrentPage(1); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors text-sm ${
            activeTab === "paquetes"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          Paquetes
        </button>
        <button
          onClick={() => { setActiveTab("carritos"); setCurrentPage(1); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors text-sm ${
            activeTab === "carritos"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Carritos
        </button>
        <button
          onClick={() => { setActiveTab("recursos"); setCurrentPage(1); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors text-sm ${
            activeTab === "recursos"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          Recursos
        </button>
        <button
          onClick={() => { setActiveTab("personal"); setCurrentPage(1); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors text-sm ${
            activeTab === "personal"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          Personal
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 p-2 rounded-lg">
              <Package className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Productos</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{allProducts.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#EF8022]/10 dark:bg-[#EF8022]/20 p-2 rounded-lg">
              <Filter className="w-5 h-5 text-[#EF8022]" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Categorías</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{categories.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
              <Layers className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Paquetes</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{paquetes.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Carritos</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{carritos.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Personal</span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">{personales.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Disponibles: {personales.filter((p) => p.estado === "disponible").length}
          </p>
        </div>

      </div>

      {activeTab === "productos" && categories.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg text-gray-900 dark:text-white">Categorías registradas</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Puedes eliminar una categoría desde aquí.</p>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{categories.length} categorías</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const productCount = category.productos.length;
              return (
                <div
                  key={category.id}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-700/50"
                >
                  <span className="text-gray-900 dark:text-white">{category.categoria}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{productCount} prod.</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(category.id, category.categoria, productCount)}
                    className="rounded-full p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Eliminar categoría"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PRODUCTOS TAB ──────────────────────────────────────── */}
      {activeTab === "productos" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por producto o SKU..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-3 w-full lg:w-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="flex-1 lg:flex-none px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
                >
                  {categoryNames.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setNewProduct({
                      categoria: "",
                      nuevaCategoria: "",
                      producto: "",
                      sku: "",
                      precio: 0
                    });
                    setShowAddProduct(true);
                  }}
                  className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Producto
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Precio</th>
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-4 text-right text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedProducts.map((product) => (
                    <tr key={`${product.categoria}-${product.id}-${product.sku}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 text-[#1F3C8B] dark:text-blue-400">
                          {product.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{product.producto}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                        {product.precio > 0 ? `S/ ${product.precio.toFixed(2)}` : "S/ 0.00"}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-500 text-sm font-mono">{product.sku}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleEditProduct(product)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:text-[#EF8022] hover:bg-[#EF8022]/10"
                            title="Editar producto"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredProducts.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredProducts.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            )}

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No se encontraron productos</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── PAQUETES TAB ───────────────────────────────────────── */}
      {activeTab === "paquetes" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar paquete..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowAddPaquete(true)}
                className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Nuevo Paquete
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPaquetes.map((paq) => (
              <div key={paq.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-gray-900 dark:text-white mb-1">{paq.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditPaquete(paq)}
                      className="p-1.5 text-gray-400 hover:text-[#EF8022] dark:hover:text-[#EF8022] transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePaquete(paq)}
                      className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Contenido {paq.contenido.length > 0 && `(${paq.contenido.length} productos)`}
                  </p>
                  <div className="space-y-1.5">
                    {paq.contenido.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">A definir por el cliente</p>
                    ) : (
                      paq.contenido.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{item.productoNombre}</span>
                          {item.cantidad > 0 && (
                            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">x{item.cantidad}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {paq.contenido.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-right">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Total: {getTotalHelados(paq.contenido)} helados
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Precio</span>
                  <span className="text-xl text-[#EF8022]">
                    {paq.precioUnitario > 0 ? `S/ ${paq.precioUnitario}` : "A cotizar"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredPaquetes.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No se encontraron paquetes</p>
            </div>
          )}
        </>
      )}

      {/* ── CARRITOS TAB ───────────────────────────────────────── */}
      {activeTab === "carritos" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
              <div>
                <h2 className="text-lg text-gray-900 dark:text-white">Carritos</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gestión y disponibilidad de carritos por fecha.</p>
              </div>
              <button
                onClick={() => { setShowAddCarrito(true); setShowNuevoTipoInput(false); setNuevoTipoNombre(""); if (carritoTipos.length === 0) void loadCarritoTipos(); }}
                className="bg-[#EF8022] text-white px-5 py-2.5 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo Carrito
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por modelo o código..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full sm:max-w-xs pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
              />
            </div>

            {/* 2-column layout: carrito list + calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              {/* Columna izquierda: lista de carritos */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sticky top-20">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Carritos ({filteredCarritos.length})
                  </h3>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredCarritos.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin carritos registrados</p>
                    ) : (
                      filteredCarritos.map((c) => {
                        const isSelected = selectedCarritoCalendarId === c.id;
                        const estadoHoy = getDynamicCarritoEstadoCalendar(c.id);
                        const estadoSelectColors: Record<Carrito["estado"], string> = {
                          disponible: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                          "en-uso": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                          mantenimiento: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                        };
                        return (
                          <div
                            key={c.id}
                            className={`rounded-lg border transition-all ${
                              isSelected
                                ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10"
                                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                            }`}
                          >
                            {/* Header clickeable para seleccionar en calendario */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCarritoCalendarId(isSelected ? 0 : c.id);
                                setSelectedCarritoCalendarDate(null);
                              }}
                              className="w-full text-left px-3 pt-2.5 pb-1"
                            >
                              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                {c.codigo} — {c.modelo}
                              </p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{c.tipoNombre}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  estadoHoy === "disponible"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}>
                                  {estadoHoy === "disponible" ? "Libre hoy" : "Ocupado hoy"}
                                </span>
                              </div>
                            </button>

                            {/* Controles */}
                            <div className="flex items-center justify-between gap-1 px-3 pb-2.5 pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                              <select
                                value={c.estado}
                                onChange={(e) => updateCarritoEstado(c.id, e.target.value as Carrito["estado"])}
                                onClick={(e) => e.stopPropagation()}
                                className={`text-[10px] px-2 py-1 rounded-full border-none focus:outline-none focus:ring-1 focus:ring-[#EF8022] ${estadoSelectColors[c.estado]}`}
                              >
                                <option value="disponible">Disponible</option>
                                <option value="en-uso">En Uso</option>
                                <option value="mantenimiento">Mantenimiento</option>
                              </select>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCarrito(c)}
                                  className="p-1 rounded text-gray-400 hover:text-[#EF8022] hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                  title="Editar carrito"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCarrito(c)}
                                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Eliminar carrito"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Columna derecha: calendario */}
              <div className="lg:col-span-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-4 sm:p-5">
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-base text-gray-900 dark:text-white">Calendario de Disponibilidad</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedCarritoCalendarId > 0
                          ? `Eventos de ${selectedCarritoCalendar?.codigo} — ${selectedCarritoCalendar?.modelo}`
                          : "Vista de ocupación global"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadCarritoCalendarData()}
                      className="px-3 py-1.5 rounded-lg border border-[#EF8022] text-[#EF8022] hover:bg-[#EF8022]/10 transition-colors text-xs whitespace-nowrap"
                    >
                      Recargar
                    </button>
                  </div>
                  {carritoCalendarError && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      {carritoCalendarError}
                    </div>
                  )}
                  {carritoCalendarLoading && (
                    <p className="text-xs text-gray-400 mb-2">Cargando...</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <button
                    type="button"
                    onClick={goToPreviousCarritoCalendarMonth}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-sm text-gray-900 dark:text-white capitalize font-medium">
                    {carritoCalendarMonthLabel}
                  </div>
                  <button
                    type="button"
                    onClick={goToNextCarritoCalendarMonth}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-gray-500 dark:text-gray-400 mb-2">
                  {DAY_HEADERS.map((day) => (
                    <div key={day} className="py-1 font-medium uppercase tracking-wide">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 mb-4">
                  {Array.from({ length: getFirstDayOfMonth(carritoCalendarYear, carritoCalendarMonth) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square rounded-lg border border-transparent" />
                  ))}
                  {Array.from({ length: getDaysInMonth(carritoCalendarYear, carritoCalendarMonth) }, (_, index) => {
                    const day = index + 1;
                    const dateStr = formatCalendarDate(new Date(carritoCalendarYear, carritoCalendarMonth, day));
                    const entries = carritoCalendarByDate[dateStr] || [];
                    const isToday = dateStr === carritoCalendarToday;
                    const isSelected = dateStr === selectedCarritoCalendarDate;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => {
                          if (entries.length > 0) {
                            setSelectedCarritoCalendarDayDate(dateStr);
                            setShowCarritoCalendarDayModal(true);
                          }
                        }}
                        className={`aspect-square rounded-lg border p-1.5 text-left transition-all flex flex-col gap-1 overflow-hidden ${
                          isSelected
                            ? "border-[#EF8022] bg-[#EF8022]/10 ring-2 ring-[#EF8022]/20"
                            : isToday
                              ? "border-[#1F3C8B] bg-[#1F3C8B]/5"
                              : entries.length > 0
                                ? "border-[#EF8022]/40 bg-white dark:bg-gray-800 hover:border-[#EF8022] hover:shadow-md"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <span className={`text-xs font-bold ${isToday ? "text-[#1F3C8B] dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                          {day}
                        </span>
                        {entries.length > 0 && (
                          <div className="space-y-0.5 flex-1 overflow-y-auto">
                            {entries.slice(0, 2).map((entry, idx) => (
                              <div key={idx} className="bg-[#EF8022]/90 rounded px-1.5 py-0.5 text-white">
                                <p className="text-[10px] font-semibold truncate leading-tight">{entry.clienteNombre}</p>
                                {entry.horaEntrega && (
                                  <p className="text-[8px] opacity-90">{entry.horaEntrega}</p>
                                )}
                              </div>
                            ))}
                            {entries.length > 2 && (
                              <div className="text-[9px] text-[#EF8022] font-medium px-1">
                                +{entries.length - 2} más
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedCarritoCalendarDate && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 mt-3">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">
                      Eventos del {new Date(`${selectedCarritoCalendarDate}T12:00:00`).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" })}
                    </h4>
                    {selectedCarritoCalendarDateEvents.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedCarritoCalendarDateEvents.map((entry) => (
                          <div key={entry.fichaId} className="rounded border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-700/50">
                            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{entry.clienteNombre}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Hora: {entry.horaEntrega || entry.horaRecojo || "—"} · {entry.carritoCount} carrito(s)</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sin eventos registrados</p>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Modal de Detalles del Día — Carritos */}
          {showCarritoCalendarDayModal && selectedCarritoCalendarDayDate && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowCarritoCalendarDayModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="mb-6">
                  <h3 className="text-2xl text-gray-900 dark:text-white mb-2">
                    {new Date(`${selectedCarritoCalendarDayDate}T12:00:00`).toLocaleDateString("es-PE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {carritoCalendarByDate[selectedCarritoCalendarDayDate]?.length || 0} evento(s) registrado(s)
                  </p>
                </div>

                {carritoCalendarByDate[selectedCarritoCalendarDayDate]?.length > 0 ? (
                  <div className="space-y-4">
                    {carritoCalendarByDate[selectedCarritoCalendarDayDate].map((entry) => {
                      const ficha = fichasCalendario.find((f) => f.id === entry.fichaId);
                      const carritosAsignados = ficha?.carritoIds
                        ? carritos.filter((c) => ficha.carritoIds.includes(c.id))
                        : [];

                      return (
                        <div key={entry.fichaId} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{entry.clienteNombre}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {entry.distrito && `📍 ${entry.distrito}`}
                              </p>
                            </div>
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EF8022]/10 text-[#EF8022] text-sm font-medium">
                              {entry.carritoCount} carrito(s)
                            </span>
                          </div>

                          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="grid grid-cols-2 gap-3">
                              {entry.horaEntrega && (
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hora Entrega</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.horaEntrega}</p>
                                </div>
                              )}
                              {entry.horaRecojo && (
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hora Recojo</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.horaRecojo}</p>
                                </div>
                              )}
                            </div>

                            {carritosAsignados.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Carritos Asignados</p>
                                <div className="flex flex-wrap gap-2">
                                  {carritosAsignados.map((c) => (
                                    <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EF8022]/10 text-[#EF8022] dark:bg-[#EF8022]/20 text-xs font-medium">
                                      🛒 {c.codigo} — {c.modelo}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Sin eventos registrados para esta fecha
                  </p>
                )}

                <button
                  onClick={() => setShowCarritoCalendarDayModal(false)}
                  className="w-full mt-6 px-4 py-2.5 rounded-lg bg-[#EF8022] text-white hover:bg-[#d9711c] transition-colors font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </>
      )}



      {/* ── RECURSOS TAB ──────────────────────────────────────── */}
      {activeTab === "recursos" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
              <div>
                <h2 className="text-lg text-gray-900 dark:text-white">Recursos</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sillas, mesas y otros recursos con control de stock.</p>
              </div>
              <button
                onClick={() => { setRecursoForm(emptyRecursoForm); setRecursoFormError(""); setShowRecursoModal(true); }}
                className="bg-[#EF8022] text-white px-5 py-2.5 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <Plus className="w-4 h-4" /> Nuevo Recurso
              </button>
            </div>

            {recursos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aún no hay recursos registrados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Recurso</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Precio</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Marca</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Stock</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {recursos.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{r.recurso}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{r.sku}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">S/ {r.precio.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.brand === "donofrio" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                            {r.brand}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={r.stockActual <= r.stockMinimo ? "text-red-500" : "text-green-600 dark:text-green-400"}>
                            {r.stockActual} / min {r.stockMinimo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button type="button" onClick={() => handleRecursoStockMovement(r, "entrada")} className="rounded-lg px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">+ Entrada</button>
                            <button type="button" onClick={() => handleRecursoStockMovement(r, "salida")} className="rounded-lg px-2 py-1 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">- Salida</button>
                            <button type="button" onClick={() => handleRecursoStockAdjustment(r)} className="rounded-lg px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">Ajustar</button>
                            <button type="button" onClick={() => handleShowRecursoStockMovements(r)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"><History className="h-3 w-3" />Historial</button>
                            <button type="button" onClick={() => handleDeleteRecurso(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── PERSONAL TAB ──────────────────────────────────────── */}
      {activeTab === "personal" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
              <div>
                <h2 className="text-lg text-gray-900 dark:text-white">Personal de Staff</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Choferes y personal de apoyo para eventos.</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Los choferes se crean en la página de rutas.</p>
              </div>
              <button
                onClick={openAddPersonal}
                className="bg-[#EF8022] text-white px-5 py-2.5 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo Personal
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, DNI o rol..."
                value={personalSearch}
                onChange={(e) => setPersonalSearch(e.target.value)}
                className="w-full sm:max-w-xs pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
              />
            </div>

            {/* Layout de 2 columnas: Personal list + Calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              {/* Columna izquierda: Lista compacta de personal */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sticky top-20">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Personal Disponible</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredPersonales.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin personal registrado</p>
                    ) : (
                      filteredPersonales.map((p) => {
                        const isSelected = selectedPersonalCalendarId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPersonalCalendarId(isSelected ? 0 : p.id);
                              setSelectedPersonalCalendarDate(null);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${
                              isSelected
                                ? "border-[#EF8022] bg-[#EF8022]/10 dark:bg-[#EF8022]/20"
                                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-[#EF8022]/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{p.nombre_completo}</p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">{p.rol}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                getDynamicPersonalEstado(p.id) === "disponible"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : getDynamicPersonalEstado(p.id) === "ocupado"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}>
                                {getDynamicPersonalEstado(p.id)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Columna derecha: Calendario */}
              <div className="lg:col-span-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-4 sm:p-5">
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-base text-gray-900 dark:text-white">Calendario de Disponibilidad</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedPersonalCalendarId > 0 ? `Eventos de ${selectedPersonalCalendar?.nombre_completo}` : "Vista de ocupación global"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadPersonalCalendarData()}
                      className="px-3 py-1.5 rounded-lg border border-[#EF8022] text-[#EF8022] hover:bg-[#EF8022]/10 transition-colors text-xs whitespace-nowrap"
                    >
                      Recargar
                    </button>
                  </div>

                  {personalCalendarError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      {personalCalendarError}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <button
                    type="button"
                    onClick={goToPreviousPersonalCalendarMonth}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-sm text-gray-900 dark:text-white capitalize font-medium">
                    {personalCalendarMonthLabel}
                  </div>
                  <button
                    type="button"
                    onClick={goToNextPersonalCalendarMonth}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-gray-500 dark:text-gray-400 mb-2">
                  {DAY_HEADERS.map((day) => (
                    <div key={day} className="py-1 font-medium uppercase tracking-wide">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 mb-4">
                  {Array.from({ length: getFirstDayOfMonth(personalCalendarYear, personalCalendarMonth) }).map((_, index) => (
                    <div key={`empty-${index}`} className="aspect-square rounded-lg border border-transparent" />
                  ))}
                  {Array.from({ length: getDaysInMonth(personalCalendarYear, personalCalendarMonth) }, (_, index) => {
                    const day = index + 1;
                    const dateStr = formatCalendarDate(new Date(personalCalendarYear, personalCalendarMonth, day));
                    const entries = personalCalendarByDate[dateStr] || [];
                    const isToday = dateStr === personalCalendarToday;
                    const isSelected = dateStr === selectedPersonalCalendarDate;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => {
                          if (entries.length > 0) {
                            setSelectedPersonalCalendarDayDate(dateStr);
                            setShowPersonalCalendarDayModal(true);
                          }
                        }}
                        className={`aspect-square rounded-lg border p-1.5 text-left transition-all flex flex-col gap-1 overflow-hidden ${
                          isSelected
                            ? "border-[#EF8022] bg-[#EF8022]/10 ring-2 ring-[#EF8022]/20"
                            : isToday
                              ? "border-[#1F3C8B] bg-[#1F3C8B]/5"
                              : entries.length > 0
                                ? "border-[#EF8022]/40 bg-white dark:bg-gray-800 hover:border-[#EF8022] hover:shadow-md"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <span className={`text-xs font-bold ${isToday ? "text-[#1F3C8B] dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                          {day}
                        </span>
                        {entries.length > 0 && (
                          <div className="space-y-0.5 flex-1 overflow-y-auto">
                            {entries.slice(0, 2).map((entry, idx) => (
                              <div key={idx} className="bg-[#EF8022]/90 rounded px-1.5 py-0.5 text-white">
                                <p className="text-[10px] font-semibold truncate leading-tight">{entry.clienteNombre}</p>
                                {entry.horaEntrega && (
                                  <p className="text-[8px] opacity-90">{entry.horaEntrega}</p>
                                )}
                              </div>
                            ))}
                            {entries.length > 2 && (
                              <div className="text-[9px] text-[#EF8022] font-medium px-1">
                                +{entries.length - 2} más
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Detalle del día seleccionado */}
                {selectedPersonalCalendarDate && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 mt-3">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">
                      Eventos del {new Date(`${selectedPersonalCalendarDate}T12:00:00`).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" })}
                    </h4>
                    {selectedPersonalCalendarDateEvents.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedPersonalCalendarDateEvents.map((entry) => (
                          <div key={entry.fichaId} className="rounded border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-700/50">
                            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{entry.clienteNombre}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Hora: {entry.horaEntrega || entry.horaRecojo || "—"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sin eventos registrados</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de Personal Completa */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#EF8022]" />
                Directorio Completo de Personal
              </h3>
              {filteredPersonales.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">{personalSearch ? "Sin resultados para la búsqueda." : "Aún no hay personal registrado."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Nombre / DNI</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Teléfono</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Rol</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredPersonales.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 dark:text-white">{p.nombre_completo}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">DNI: {p.dni || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.numero_telefono || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.rol === "chofer" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                            {p.rol}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${estadoPersonalColor[getDynamicPersonalEstado(p.id)]}`}>
                            {getDynamicPersonalEstado(p.id)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditPersonal(p)}
                              disabled={p.rol === "chofer"}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#EF8022] hover:bg-[#EF8022]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={p.rol === "chofer" ? "Editar en Logística" : "Editar"}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePersonal(p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Eliminar"
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
              )}
            </div>
          </div>

          {/* Modal de Detalles del Día */}
          {showPersonalCalendarDayModal && selectedPersonalCalendarDayDate && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
                <button 
                  onClick={() => setShowPersonalCalendarDayModal(false)} 
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="mb-6">
                  <h3 className="text-2xl text-gray-900 dark:text-white mb-2">
                    {new Date(`${selectedPersonalCalendarDayDate}T12:00:00`).toLocaleDateString("es-PE", { 
                      weekday: "long", 
                      day: "numeric", 
                      month: "long", 
                      year: "numeric" 
                    })}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {personalCalendarByDate[selectedPersonalCalendarDayDate]?.length || 0} evento(s) registrado(s)
                  </p>
                </div>

                {personalCalendarByDate[selectedPersonalCalendarDayDate] && 
                 personalCalendarByDate[selectedPersonalCalendarDayDate].length > 0 ? (
                  <div className="space-y-4">
                    {personalCalendarByDate[selectedPersonalCalendarDayDate].map((entry) => {
                      const ficha = fichasCalendario.find(f => f.id === entry.fichaId);
                      const personalOcupado = ficha?.personalIds 
                        ? personales.filter(p => ficha.personalIds.includes(p.id))
                        : [];

                      return (
                        <div 
                          key={entry.fichaId} 
                          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {entry.clienteNombre}
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {entry.distrito && `📍 ${entry.distrito}`}
                              </p>
                            </div>
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EF8022]/10 text-[#EF8022] text-sm font-medium">
                              {entry.personalCount} personal
                            </span>
                          </div>

                          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="grid grid-cols-2 gap-3">
                              {entry.horaEntrega && (
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hora Entrega</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.horaEntrega}</p>
                                </div>
                              )}
                              {entry.horaRecojo && (
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hora Recojo</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.horaRecojo}</p>
                                </div>
                              )}
                            </div>

                            {personalOcupado.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Personal Asignado</p>
                                <div className="flex flex-wrap gap-2">
                                  {personalOcupado.map(p => (
                                    <span 
                                      key={p.id}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1F3C8B]/10 text-[#1F3C8B] dark:bg-[#1F3C8B]/20 text-xs font-medium"
                                    >
                                      👤 {p.nombre_completo || p.nombre}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Sin eventos registrados para esta fecha
                  </p>
                )}

                <button
                  onClick={() => setShowPersonalCalendarDayModal(false)}
                  className="w-full mt-6 px-4 py-2.5 rounded-lg bg-[#EF8022] text-white hover:bg-[#d9711c] transition-colors font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Personal Modal (Add / Edit) ────────────────────────── */}
      {showPersonalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowPersonalModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6">
              {editingPersonal ? "Editar Personal" : "Nuevo Personal"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={personalForm.nombre_completo}
                  onChange={(e) => setPersonalForm({ ...personalForm, nombre_completo: e.target.value })}
                  placeholder="Ej: Juan Pérez García"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">DNI * (8 dígitos)</label>
                  <input
                    type="text"
                    value={personalForm.dni}
                    onChange={(e) => setPersonalForm({ ...personalForm, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                    placeholder="12345678"
                    maxLength={8}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Fecha de nacimiento *</label>
                  <input
                    type="date"
                    value={personalForm.fecha_nacimiento}
                    onChange={(e) => setPersonalForm({ ...personalForm, fecha_nacimiento: e.target.value })}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Número de teléfono *</label>
                <input
                  type="text"
                  value={personalForm.numero_telefono}
                  onChange={(e) => setPersonalForm({ ...personalForm, numero_telefono: e.target.value })}
                  placeholder="Ej: +51987654321 · 987654321 · 987-654-321"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                  <select
                    value={personalForm.rol}
                    onChange={(e) => setPersonalForm({ ...personalForm, rol: e.target.value as Personal["rol"] })}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    {editingPersonal?.rol === "chofer" ? (
                      <option value="chofer">Chofer</option>
                    ) : (
                      <option value="apoyo">Apoyo</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                  <select
                    value={personalForm.estado}
                    onChange={(e) => setPersonalForm({ ...personalForm, estado: e.target.value as Personal["estado"] })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="disponible">Disponible</option>
                    <option value="ocupado">Ocupado</option>
                    <option value="descanso">Descanso</option>
                  </select>
                </div>
              </div>

              {personalFormError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{personalFormError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPersonalModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={personalFormSubmitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitPersonal}
                  disabled={personalFormSubmitting}
                  className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60"
                >
                  {personalFormSubmitting ? "Guardando..." : editingPersonal ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recurso Stock Movement Modal ────────────────────── */}
      {showRecursoStockMovementModal && selectedRecurso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 relative">
            <button onClick={() => setShowRecursoStockMovementModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">{recursoStockMovementType === "entrada" ? "+ Entrada" : "- Salida"} de Stock</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{selectedRecurso.recurso}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cantidad *</label>
                <input type="number" min={1} value={recursoStockMovementForm.cantidad} onChange={(e) => setRecursoStockMovementForm((prev) => ({ ...prev, cantidad: Number(e.target.value), error: "" }))} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Motivo *</label>
                <input type="text" value={recursoStockMovementForm.motivo} onChange={(e) => setRecursoStockMovementForm((prev) => ({ ...prev, motivo: e.target.value, error: "" }))} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
              </div>
              {recursoStockMovementForm.error && <p className="text-sm text-red-500">{recursoStockMovementForm.error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowRecursoStockMovementModal(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button onClick={submitRecursoStockMovement} disabled={recursoStockMovementForm.submitting} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60">{recursoStockMovementForm.submitting ? "Guardando..." : "Guardar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recurso Stock Adjustment Modal ──────────────────── */}
      {showRecursoStockAdjustmentModal && selectedRecurso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 relative">
            <button onClick={() => setShowRecursoStockAdjustmentModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">Ajustar Stock</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{selectedRecurso.recurso}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Actual *</label>
                <input type="number" min={0} value={recursoStockAdjustmentForm.stockActual} onChange={(e) => setRecursoStockAdjustmentForm((prev) => ({ ...prev, stockActual: Number(e.target.value), error: "" }))} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Mínimo *</label>
                <input type="number" min={0} value={recursoStockAdjustmentForm.stockMinimo} onChange={(e) => setRecursoStockAdjustmentForm((prev) => ({ ...prev, stockMinimo: Number(e.target.value), error: "" }))} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
                <input type="text" value={recursoStockAdjustmentForm.motivo} onChange={(e) => setRecursoStockAdjustmentForm((prev) => ({ ...prev, motivo: e.target.value, error: "" }))} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
              </div>
              {recursoStockAdjustmentForm.error && <p className="text-sm text-red-500">{recursoStockAdjustmentForm.error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowRecursoStockAdjustmentModal(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button onClick={submitRecursoStockAdjustment} disabled={recursoStockAdjustmentForm.submitting} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60">{recursoStockAdjustmentForm.submitting ? "Guardando..." : "Guardar Ajuste"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recurso Stock History Modal ──────────────────────── */}
      {showRecursoStockHistoryModal && selectedRecurso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowRecursoStockHistoryModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">Historial de Movimientos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{selectedRecurso.recurso}</p>
            {recursoStockHistoryState.loading && <p className="text-sm text-gray-500 dark:text-gray-400">Cargando historial...</p>}
            {!recursoStockHistoryState.loading && recursoStockHistoryState.error && <p className="text-sm text-red-500">{recursoStockHistoryState.error}</p>}
            {!recursoStockHistoryState.loading && !recursoStockHistoryState.error && recursoStockHistoryState.movements.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Sin movimientos registrados.</p>}
            {!recursoStockHistoryState.loading && !recursoStockHistoryState.error && recursoStockHistoryState.movements.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-gray-600 dark:text-gray-300 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-600 dark:text-gray-300 uppercase">Tipo</th>
                      <th className="px-3 py-2 text-right text-xs text-gray-600 dark:text-gray-300 uppercase">Cantidad</th>
                      <th className="px-3 py-2 text-right text-xs text-gray-600 dark:text-gray-300 uppercase">Anterior</th>
                      <th className="px-3 py-2 text-right text-xs text-gray-600 dark:text-gray-300 uppercase">Nuevo</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-600 dark:text-gray-300 uppercase">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {recursoStockHistoryState.movements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{m.createdAt ? new Date(m.createdAt).toLocaleString("es-PE") : "-"}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-1 rounded-full text-xs ${m.tipo === "entrada" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : m.tipo === "salida" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>{m.tipo}</span></td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{m.cantidad}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{m.stockAnterior}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{m.stockNuevo}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Product Modal ──────────────────────────────────── */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative">
            <button onClick={() => setShowAddProduct(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6">{editingProduct ? "Editar Producto" : "Nuevo Producto"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Categoría existente</label>
                <select
                  value={newProduct.categoria}
                  onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value, nuevaCategoria: "" })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.categoria}>{c.categoria}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">O crear nueva categoría</label>
                <input
                  type="text"
                  value={newProduct.nuevaCategoria}
                  onChange={(e) => setNewProduct({ ...newProduct, nuevaCategoria: e.target.value, categoria: "" })}
                  placeholder="Ej: Magnum"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  value={newProduct.producto}
                  onChange={(e) => setNewProduct({ ...newProduct, producto: e.target.value })}
                  placeholder="Ej: Magnum Clásico"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="Ej: MAGNUM-001"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Precio (S/)</label>
                  <input
                    type="number"
                    value={newProduct.precio || ""}
                    onChange={(e) => setNewProduct({ ...newProduct, precio: Number(e.target.value) })}
                    placeholder="0"
                    min={0}
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddProduct(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveProduct} disabled={productFormSubmitting} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {productFormSubmitting ? "Guardando..." : editingProduct ? "Actualizar Producto" : "Guardar Producto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Paquete Modal (with catalog selector) ──────────── */}
      {showAddPaquete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 my-8 relative">
            <button onClick={closePaqueteModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">
              {editingPaquete ? "Editar Paquete" : "Nuevo Paquete"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Selecciona productos del catálogo para armar el paquete.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre del Paquete *</label>
                <input
                  type="text"
                  value={newPaquete.nombre}
                  onChange={(e) => {
                    setNewPaquete({ ...newPaquete, nombre: e.target.value });
                    if (e.target.value.trim()) setPaqueteFormErrors((prev) => ({ ...prev, nombre: false }));
                  }}
                  placeholder="Ej: Paquete Premium"
                  className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] ${
                    paqueteFormErrors.nombre
                      ? "border-red-500 dark:border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                />
                {paqueteFormErrors.nombre && (
                  <p className="mt-1 text-xs text-red-500">El nombre del paquete es obligatorio.</p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Precio total del paquete (auto)</span>
                  <span className="text-lg text-[#EF8022]">S/ {precioTotalPaquete.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Se calcula con la suma de (precio del producto x cantidad).</p>
                <div className="mt-3">
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Precio final editable (S/)</label>
                  <input
                    type="number"
                    value={newPaquete.precioUnitario}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setNewPaquete((prev) => ({
                        ...prev,
                        precioUnitario: Number.isFinite(value) ? value : 0,
                        precioEditadoManualmente: true,
                      }));
                    }}
                    min={0}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPaquete((prev) => ({ ...prev, precioUnitario: Number(precioTotalPaquete.toFixed(2)), precioEditadoManualmente: false }))}
                    className="mt-2 text-xs text-[#EF8022] hover:underline"
                  >
                    Usar valor autocalculado
                  </button>
                </div>
              </div>

              {/* Contenido con selector de catálogo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">Contenido del Paquete</label>
                  {newPaquete.contenidoItems.filter((i) => i.cantidad > 0).length > 0 && (
                    <span className="text-xs text-[#EF8022]">
                      Total: {newPaquete.contenidoItems.reduce((s, i) => s + (i.cantidad || 0), 0)} helados
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {newPaquete.contenidoItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <ProductSelector
                        allProducts={allProducts}
                        selectedSku={item.productoSku}
                        onSelect={(sku, nombre) => {
                          const items = [...newPaquete.contenidoItems];
                          items[idx] = { ...items[idx], productoSku: sku, productoNombre: nombre };
                          updatePaqueteItems(items);
                        }}
                      />
                      <input
                        type="number"
                        value={item.cantidad || ""}
                        onChange={(e) => {
                          const items = [...newPaquete.contenidoItems];
                          items[idx] = { ...items[idx], cantidad: Number(e.target.value) };
                          updatePaqueteItems(items);
                        }}
                        placeholder="Cant."
                        min={0}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                      />
                      <div className="w-28 px-2 py-2 text-right text-xs text-gray-500 dark:text-gray-400">
                        S/ {((Number(allProducts.find((p) => p.sku === item.productoSku)?.precio || 0)) * (item.cantidad || 0)).toFixed(2)}
                      </div>
                      {newPaquete.contenidoItems.length > 1 && (
                        <button
                          onClick={() => {
                            updatePaqueteItems(newPaquete.contenidoItems.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-red-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    updatePaqueteItems([...newPaquete.contenidoItems, { productoSku: "", productoNombre: "", cantidad: 0 }])
                  }
                  className="mt-2 text-sm text-[#EF8022] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Agregar producto al paquete
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={closePaqueteModal} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSavePaquete} disabled={paqueteFormSubmitting} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {paqueteFormSubmitting ? "Guardando..." : editingPaquete ? "Actualizar Paquete" : "Guardar Paquete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Carrito Modal ─────────────────────────────────── */}
      {showAddCarrito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative">
            <button onClick={() => setShowAddCarrito(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6">Nuevo Carrito</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre de la unidad *</label>
                  <input
                    type="text"
                    value={newCarrito.modelo}
                    onChange={(e) => setNewCarrito({ ...newCarrito, modelo: e.target.value })}
                    placeholder="Ej: Carrito Helado #1"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Código *</label>
                  <input
                    type="text"
                    value={newCarrito.codigo}
                    onChange={(e) => setNewCarrito({ ...newCarrito, codigo: e.target.value })}
                    placeholder="Ej: CH-001"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">Tipo *</label>
                  <button type="button" onClick={() => setShowNuevoTipoInput((v) => !v)} className="text-xs text-[#EF8022] hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Nuevo tipo
                  </button>
                </div>
                {showNuevoTipoInput && (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoTipoNombre}
                      onChange={(e) => setNuevoTipoNombre(e.target.value)}
                      placeholder="Ej: Carrito Algodón"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddNuevoTipo("add"); }}}
                    />
                    <button type="button" onClick={() => void handleAddNuevoTipo("add")} disabled={nuevoTipoSubmitting || !nuevoTipoNombre.trim()} className="px-3 py-2 text-sm bg-[#EF8022] text-white rounded-lg hover:bg-[#d9711c] disabled:opacity-50">
                      {nuevoTipoSubmitting ? "..." : "Guardar"}
                    </button>
                  </div>
                )}
                <select
                  value={newCarrito.tipoId}
                  onChange={(e) => setNewCarrito({ ...newCarrito, tipoId: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                >
                  <option value={0}>{carritoTiposLoading ? "Cargando tipos..." : "Seleccionar tipo..."}</option>
                  {carritoTipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={newCarrito.descripcion}
                  onChange={(e) => setNewCarrito({ ...newCarrito, descripcion: e.target.value })}
                  placeholder="Ej: Carrito para eventos corporativos"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Estado inicial</label>
                <select
                  value={newCarrito.estado}
                  onChange={(e) => setNewCarrito({ ...newCarrito, estado: e.target.value as Carrito["estado"] })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                >
                  <option value="disponible">Disponible</option>
                  <option value="en-uso">En Uso</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddCarrito(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAddCarrito} disabled={carritoFormSubmitting} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {carritoFormSubmitting ? "Guardando..." : "Guardar Carrito"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Carrito Modal ───────────────────────────────── */}
      {showEditCarrito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative">
            <button onClick={() => setShowEditCarrito(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6">Editar Carrito</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre de la unidad *</label>
                  <input
                    type="text"
                    value={editCarritoForm.modelo}
                    onChange={(e) => setEditCarritoForm({ ...editCarritoForm, modelo: e.target.value })}
                    placeholder="Ej: Carrito Helado #1"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Código *</label>
                  <input
                    type="text"
                    value={editCarritoForm.codigo}
                    onChange={(e) => setEditCarritoForm({ ...editCarritoForm, codigo: e.target.value })}
                    placeholder="Ej: CH-001"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">Tipo *</label>
                  <button type="button" onClick={() => setShowNuevoTipoInput((v) => !v)} className="text-xs text-[#EF8022] hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Nuevo tipo
                  </button>
                </div>
                {showNuevoTipoInput && (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoTipoNombre}
                      onChange={(e) => setNuevoTipoNombre(e.target.value)}
                      placeholder="Ej: Carrito Algodón"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddNuevoTipo("edit"); }}}
                    />
                    <button type="button" onClick={() => void handleAddNuevoTipo("edit")} disabled={nuevoTipoSubmitting || !nuevoTipoNombre.trim()} className="px-3 py-2 text-sm bg-[#EF8022] text-white rounded-lg hover:bg-[#d9711c] disabled:opacity-50">
                      {nuevoTipoSubmitting ? "..." : "Guardar"}
                    </button>
                  </div>
                )}
                <select
                  value={editCarritoForm.tipoId}
                  onChange={(e) => setEditCarritoForm({ ...editCarritoForm, tipoId: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                >
                  <option value={0}>{carritoTiposLoading ? "Cargando tipos..." : "Seleccionar tipo..."}</option>
                  {carritoTipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={editCarritoForm.descripcion}
                  onChange={(e) => setEditCarritoForm({ ...editCarritoForm, descripcion: e.target.value })}
                  placeholder="Ej: Carrito para eventos corporativos"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                <select
                  value={editCarritoForm.estado}
                  onChange={(e) => setEditCarritoForm({ ...editCarritoForm, estado: e.target.value as Carrito["estado"] })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                >
                  <option value="disponible">Disponible</option>
                  <option value="en-uso">En Uso</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEditCarrito(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveEditCarrito} disabled={editCarritoSubmitting} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {editCarritoSubmitting ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Recurso Modal ──────────────────────────────────── */}
      {showRecursoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative">
            <button onClick={() => setShowRecursoModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-6">Nuevo Recurso</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre del Recurso *</label>
                <input type="text" value={recursoForm.recurso} onChange={(e) => setRecursoForm({ ...recursoForm, recurso: e.target.value })} placeholder="Ej: Silla plegable" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">SKU *</label>
                  <input type="text" value={recursoForm.sku} onChange={(e) => setRecursoForm({ ...recursoForm, sku: e.target.value })} placeholder="Ej: REC-001" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Precio (S/)</label>
                  <input type="number" value={recursoForm.precio || ""} onChange={(e) => setRecursoForm({ ...recursoForm, precio: Number(e.target.value) })} placeholder="0.00" min={0} step="0.01" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Marca</label>
                <select value={recursoForm.brand} onChange={(e) => setRecursoForm({ ...recursoForm, brand: e.target.value as Recurso["brand"] })} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]">
                  <option value="donofrio">D'Onofrio</option>
                  <option value="jugueton">Juguetón</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Inicial</label>
                  <input type="number" value={recursoForm.stockActual} onChange={(e) => setRecursoForm({ ...recursoForm, stockActual: Number(e.target.value) })} min={0} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Mínimo</label>
                  <input type="number" value={recursoForm.stockMinimo} onChange={(e) => setRecursoForm({ ...recursoForm, stockMinimo: Number(e.target.value) })} min={0} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]" />
                </div>
              </div>
              {recursoFormError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{recursoFormError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowRecursoModal(false)} disabled={recursoFormSubmitting} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button onClick={handleSaveRecurso} disabled={recursoFormSubmitting} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60">{recursoFormSubmitting ? "Guardando..." : "Guardar Recurso"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
