import { useState } from "react";
import { Search, Package, Plus, Filter, X, Layers, Trash2, ChevronDown, Check, ShoppingCart, History } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { useProducts } from "../contexts/ProductsContext";
import type { PaqueteItem, FlatProduct, Carrito, ProductStockMovement } from "../contexts/ProductsContext";

const ITEMS_PER_PAGE = 15;

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
      p.categoria.toLowerCase().includes(search.toLowerCase()) ||
      p.sabor.toLowerCase().includes(search.toLowerCase())
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
            ? `${selectedProduct.producto} (${selectedProduct.presentacion})`
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
                  onSelect(p.sku, `${p.producto} (${p.presentacion} - ${p.sabor})`);
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
                  <span className="text-gray-400 ml-1 text-xs">
                    {p.presentacion} · {p.sabor.length > 30 ? p.sabor.substring(0, 30) + "..." : p.sabor}
                  </span>
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
  const [activeTab, setActiveTab] = useState<"productos" | "paquetes" | "carritos" | "recursos">("productos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [currentPage, setCurrentPage] = useState(1);

  // ← shared context instead of local state
  const {
    categories,
    allProducts,
    addProduct,
    deleteProduct,
    updateProductStock,
    addProductStockMovement,
    getProductStockMovements,
    deleteCategory,
    paquetes,
    addPaquete,
    deletePaquete,
    carritos,
    addCarrito,
    updateCarritoEstado,
    deleteCarrito,
  } = useProducts();

  // Product modal
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    categoria: "",
    nuevaCategoria: "",
    producto: "",
    presentacion: "",
    sabor: "",
    precio: 0,
    stockActual: 0,
    stockMinimo: 0,
  });

  // Package modal
  const [showAddPaquete, setShowAddPaquete] = useState(false);
  const [newPaquete, setNewPaquete] = useState({
    nombre: "",
    precioUnitario: 0,
    contenidoItems: [{ productoSku: "", productoNombre: "", cantidad: 0 }] as PaqueteItem[],
  });

  // Carrito modal
  const [showAddCarrito, setShowAddCarrito] = useState(false);
  const [newCarrito, setNewCarrito] = useState({
    modelo: "Blanco" as Carrito["modelo"],
    codigo: "",
    descripcion: "",
    cantidadTotal: 1,
    estado: "disponible" as Carrito["estado"],
  });

  const [selectedStockProduct, setSelectedStockProduct] = useState<FlatProduct | null>(null);
  const [showStockMovementModal, setShowStockMovementModal] = useState(false);
  const [stockMovementType, setStockMovementType] = useState<"entrada" | "salida">("entrada");
  const [stockMovementForm, setStockMovementForm] = useState({
    cantidad: 1,
    motivo: "",
    submitting: false,
    error: "",
  });

  const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
  const [stockAdjustmentForm, setStockAdjustmentForm] = useState({
    stockActual: 0,
    stockMinimo: 0,
    motivo: "",
    submitting: false,
    error: "",
  });

  const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
  const [stockHistoryState, setStockHistoryState] = useState<{
    loading: boolean;
    error: string;
    movements: ProductStockMovement[];
  }>({ loading: false, error: "", movements: [] });

  // Filter products
  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch =
      product.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sabor.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  // Add product via context
  const handleAddProduct = async () => {
    if (!newProduct.producto || !newProduct.presentacion || !newProduct.sabor) return;
    const catName = newProduct.nuevaCategoria || newProduct.categoria;
    if (!catName) return;

    const sku = `${newProduct.producto}/${newProduct.presentacion}/${newProduct.sabor}`;
    await addProduct(catName, {
      producto: newProduct.producto,
      presentacion: newProduct.presentacion,
      sabor: newProduct.sabor,
      precio: Number(newProduct.precio || 0),
      stockActual: Number(newProduct.stockActual || 0),
      stockMinimo: Number(newProduct.stockMinimo || 0),
      sku,
    });

    setShowAddProduct(false);
    setNewProduct({
      categoria: "",
      nuevaCategoria: "",
      producto: "",
      presentacion: "",
      sabor: "",
      precio: 0,
      stockActual: 0,
      stockMinimo: 0,
    });
  };

  // Add paquete via context
  const handleAddPaquete = async () => {
    if (!newPaquete.nombre) return;
    await addPaquete({
      nombre: newPaquete.nombre,
      precioUnitario: newPaquete.precioUnitario,
      contenido: newPaquete.contenidoItems.filter((i) => i.productoSku && i.cantidad > 0),
    });
    setShowAddPaquete(false);
    setNewPaquete({
      nombre: "",
      precioUnitario: 0,
      contenidoItems: [{ productoSku: "", productoNombre: "", cantidad: 0 }],
    });
  };

  const handleAddCarrito = async () => {
    const codigo = newCarrito.codigo.trim();
    const descripcion = newCarrito.descripcion.trim();
    if (!codigo || !descripcion || newCarrito.cantidadTotal <= 0) return;

    await addCarrito({
      modelo: newCarrito.modelo,
      codigo,
      descripcion,
      cantidadTotal: newCarrito.cantidadTotal,
      estado: newCarrito.estado,
    });

    setShowAddCarrito(false);
    setNewCarrito({
      modelo: "Blanco",
      codigo: "",
      descripcion: "",
      cantidadTotal: 1,
      estado: "disponible",
    });
  };

  const getTotalHelados = (contenido: PaqueteItem[]) =>
    contenido.reduce((s, i) => s + i.cantidad, 0);

  const handleDeleteProduct = async (product: FlatProduct) => {
    const confirmed = window.confirm(`¿Eliminar el producto ${product.producto} (${product.presentacion})? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    await deleteProduct(product.id);
  };

  const handleDeleteCategory = async (categoryId: number, categoryName: string, productCount: number) => {
    const confirmed = window.confirm(
      `¿Eliminar la categoría ${categoryName}?${productCount > 0 ? ` También se eliminarán sus ${productCount} productos.` : ""}`
    );
    if (!confirmed) return;

    await deleteCategory(categoryId);
  };

  const handleStockAdjustment = (product: FlatProduct) => {
    setSelectedStockProduct(product);
    setStockAdjustmentForm({
      stockActual: product.stockActual,
      stockMinimo: product.stockMinimo,
      motivo: "Conteo fisico",
      submitting: false,
      error: "",
    });
    setShowStockAdjustmentModal(true);
  };

  const handleStockMovement = (product: FlatProduct, tipo: "entrada" | "salida") => {
    setSelectedStockProduct(product);
    setStockMovementType(tipo);
    setStockMovementForm({
      cantidad: 1,
      motivo: tipo === "entrada" ? "Compra proveedor" : "Venta",
      submitting: false,
      error: "",
    });
    setShowStockMovementModal(true);
  };

  const handleShowStockMovements = async (product: FlatProduct) => {
    setSelectedStockProduct(product);
    setShowStockHistoryModal(true);
    setStockHistoryState({ loading: true, error: "", movements: [] });

    try {
      const movements = await getProductStockMovements(product.id);
      setStockHistoryState({ loading: false, error: "", movements });
    } catch (error) {
      setStockHistoryState({
        loading: false,
        error: error instanceof Error ? error.message : "No se pudo cargar el historial de stock.",
        movements: [],
      });
    }
  };

  const submitStockMovement = async () => {
    if (!selectedStockProduct) return;

    if (!Number.isFinite(stockMovementForm.cantidad) || stockMovementForm.cantidad <= 0) {
      setStockMovementForm((prev) => ({ ...prev, error: "La cantidad debe ser mayor a 0." }));
      return;
    }
    if (!stockMovementForm.motivo.trim()) {
      setStockMovementForm((prev) => ({ ...prev, error: "El motivo es obligatorio." }));
      return;
    }

    setStockMovementForm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await addProductStockMovement(selectedStockProduct.id, {
        tipo: stockMovementType,
        cantidad: stockMovementForm.cantidad,
        motivo: stockMovementForm.motivo.trim(),
      });
      setShowStockMovementModal(false);
    } catch (error) {
      setStockMovementForm((prev) => ({
        ...prev,
        submitting: false,
        error: error instanceof Error ? error.message : "No se pudo registrar el movimiento.",
      }));
      return;
    }
    setStockMovementForm((prev) => ({ ...prev, submitting: false }));
  };

  const submitStockAdjustment = async () => {
    if (!selectedStockProduct) return;

    if (!Number.isFinite(stockAdjustmentForm.stockActual) || stockAdjustmentForm.stockActual < 0) {
      setStockAdjustmentForm((prev) => ({ ...prev, error: "El stock actual debe ser mayor o igual a 0." }));
      return;
    }
    if (!Number.isFinite(stockAdjustmentForm.stockMinimo) || stockAdjustmentForm.stockMinimo < 0) {
      setStockAdjustmentForm((prev) => ({ ...prev, error: "El stock minimo debe ser mayor o igual a 0." }));
      return;
    }

    setStockAdjustmentForm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await updateProductStock(selectedStockProduct.id, {
        stockActual: stockAdjustmentForm.stockActual,
        stockMinimo: stockAdjustmentForm.stockMinimo,
        motivo: stockAdjustmentForm.motivo.trim(),
      });
      setShowStockAdjustmentModal(false);
    } catch (error) {
      setStockAdjustmentForm((prev) => ({
        ...prev,
        submitting: false,
        error: error instanceof Error ? error.message : "No se pudo ajustar el stock.",
      }));
      return;
    }
    setStockAdjustmentForm((prev) => ({ ...prev, submitting: false }));
  };



  return (
    <div className="p-4 sm:p-6 md:p-8">
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Bajo minimo: {allProducts.filter((product) => product.stockActual <= product.stockMinimo).length}
          </p>
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
                    placeholder="Buscar por producto, sabor o SKU..."
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
                  onClick={() => setShowAddProduct(true)}
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
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Presentación</th>
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Sabor</th>
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Precio</th>
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Stock</th>
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
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-[#EF8022]/10 dark:bg-[#EF8022]/20 text-[#EF8022]">
                          {product.presentacion}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm max-w-xs">{product.sabor}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                        {product.precio > 0 ? `S/ ${product.precio.toFixed(2)}` : "S/ 0.00"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-col gap-1">
                          <span className={`${product.stockActual <= product.stockMinimo ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                            {product.stockActual} und.
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Min: {product.stockMinimo}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-500 text-sm font-mono">{product.sku}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleStockMovement(product, "entrada")}
                            className="rounded-lg px-2.5 py-1.5 text-xs bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                            title="Registrar entrada"
                          >
                            + Entrada
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStockMovement(product, "salida")}
                            className="rounded-lg px-2.5 py-1.5 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                            title="Registrar salida"
                          >
                            - Salida
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStockAdjustment(product)}
                            className="rounded-lg px-2.5 py-1.5 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                            title="Ajustar stock"
                          >
                            Ajustar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShowStockMovements(product)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                            title="Ver movimientos"
                          >
                            <History className="h-3.5 w-3.5" />
                            Historial
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
                  <button
                    onClick={() => deletePaquete(paq.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar carrito por modelo o código..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowAddCarrito(true)}
                className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Nuevo Carrito
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCarritos.map((carrito) => {
                const getEstadoConfig = (estado: Carrito["estado"]) => {
                  switch (estado) {
                    case "disponible":
                      return { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Disponible" };
                    case "en-uso":
                      return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", label: "En Uso" };
                    case "mantenimiento":
                      return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Mantenimiento" };
                  }
                };
                const estadoConfig = getEstadoConfig(carrito.estado);

                return (
                  <div key={carrito.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5 text-[#EF8022]" />
                          {carrito.modelo}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{carrito.codigo}</p>
                      </div>
                      <button
                        onClick={() => deleteCarrito(carrito.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{carrito.descripcion}</p>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cantidad Total</span>
                        <span className="text-2xl text-gray-900 dark:text-white font-semibold">{carrito.cantidadTotal}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Estado</span>
                      <select
                        value={carrito.estado}
                        onChange={(e) => updateCarritoEstado(carrito.id, e.target.value as Carrito["estado"])}
                        className={`px-3 py-1.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.text} border-none focus:outline-none focus:ring-2 focus:ring-[#EF8022]`}
                      >
                        <option value="disponible">Disponible</option>
                        <option value="en-uso">En Uso</option>
                        <option value="mantenimiento">Mantenimiento</option>
                      </select>
                    </div>
                  </div>
                );
              })}
          </div>

          {filteredCarritos.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {carritos.length === 0 ? "No hay carritos registrados" : "No se encontraron carritos"}
              </p>
            </div>
          )}
        </>
      )}



      {/* ── RECURSOS TAB ──────────────────────────────────────── */}
      {activeTab === "recursos" && (
        <>
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg text-gray-900 dark:text-white">Inventario de Productos</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Gestiona stock actual, minimo y movimientos.</p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{allProducts.length} productos</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Categoria</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Stock</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {allProducts.slice(0, 25).map((product) => (
                      <tr key={`recurso-stock-${product.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.producto}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{product.categoria}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`${product.stockActual <= product.stockMinimo ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                            {product.stockActual} / min {product.stockMinimo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleStockMovement(product, "entrada")}
                              className="rounded-lg px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                            >
                              + Entrada
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStockMovement(product, "salida")}
                              className="rounded-lg px-2 py-1 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                            >
                              - Salida
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStockAdjustment(product)}
                              className="rounded-lg px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              Ajustar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShowStockMovements(product)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                            >
                              <History className="h-3 w-3" />
                              Historial
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>


          </div>
        </>
      )}

      {/* ── Stock Movement Modal (+ Entrada / - Salida) ─────── */}
      {showStockMovementModal && selectedStockProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowStockMovementModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">
              {stockMovementType === "entrada" ? "+ Entrada" : "- Salida"} de Stock
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{selectedStockProduct.producto}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cantidad *</label>
                <input
                  type="number"
                  min={1}
                  value={stockMovementForm.cantidad}
                  onChange={(e) => setStockMovementForm((prev) => ({ ...prev, cantidad: Number(e.target.value), error: "" }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Motivo *</label>
                <input
                  type="text"
                  value={stockMovementForm.motivo}
                  onChange={(e) => setStockMovementForm((prev) => ({ ...prev, motivo: e.target.value, error: "" }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              {stockMovementForm.error && (
                <p className="text-sm text-red-500">{stockMovementForm.error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowStockMovementModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitStockMovement}
                  disabled={stockMovementForm.submitting}
                  className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60"
                >
                  {stockMovementForm.submitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Adjustment Modal ───────────────────────────── */}
      {showStockAdjustmentModal && selectedStockProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowStockAdjustmentModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">Ajustar Stock</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{selectedStockProduct.producto}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Actual *</label>
                <input
                  type="number"
                  min={0}
                  value={stockAdjustmentForm.stockActual}
                  onChange={(e) => setStockAdjustmentForm((prev) => ({ ...prev, stockActual: Number(e.target.value), error: "" }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Minimo *</label>
                <input
                  type="number"
                  min={0}
                  value={stockAdjustmentForm.stockMinimo}
                  onChange={(e) => setStockAdjustmentForm((prev) => ({ ...prev, stockMinimo: Number(e.target.value), error: "" }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
                <input
                  type="text"
                  value={stockAdjustmentForm.motivo}
                  onChange={(e) => setStockAdjustmentForm((prev) => ({ ...prev, motivo: e.target.value, error: "" }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              {stockAdjustmentForm.error && (
                <p className="text-sm text-red-500">{stockAdjustmentForm.error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowStockAdjustmentModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitStockAdjustment}
                  disabled={stockAdjustmentForm.submitting}
                  className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors disabled:opacity-60"
                >
                  {stockAdjustmentForm.submitting ? "Guardando..." : "Guardar Ajuste"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock History Modal ──────────────────────────────── */}
      {showStockHistoryModal && selectedStockProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowStockHistoryModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">Historial de Movimientos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{selectedStockProduct.producto}</p>

            {stockHistoryState.loading && <p className="text-sm text-gray-500 dark:text-gray-400">Cargando historial...</p>}
            {!stockHistoryState.loading && stockHistoryState.error && (
              <p className="text-sm text-red-500">{stockHistoryState.error}</p>
            )}
            {!stockHistoryState.loading && !stockHistoryState.error && stockHistoryState.movements.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin movimientos registrados.</p>
            )}

            {!stockHistoryState.loading && !stockHistoryState.error && stockHistoryState.movements.length > 0 && (
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
                    {stockHistoryState.movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {movement.createdAt ? new Date(movement.createdAt).toLocaleString("es-PE") : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            movement.tipo === "entrada"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : movement.tipo === "salida"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {movement.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{movement.cantidad}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{movement.stockAnterior}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{movement.stockNuevo}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{movement.motivo}</td>
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
            <h3 className="text-xl text-gray-900 dark:text-white mb-6">Nuevo Producto</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Presentación *</label>
                  <input
                    type="text"
                    value={newProduct.presentacion}
                    onChange={(e) => setNewProduct({ ...newProduct, presentacion: e.target.value })}
                    placeholder="Ej: Paleta"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Sabor *</label>
                  <input
                    type="text"
                    value={newProduct.sabor}
                    onChange={(e) => setNewProduct({ ...newProduct, sabor: e.target.value })}
                    placeholder="Ej: Vainilla con chocolate"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    value={newProduct.stockActual}
                    onChange={(e) => setNewProduct({ ...newProduct, stockActual: Number(e.target.value) })}
                    min={0}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Stock Minimo</label>
                  <input
                    type="number"
                    value={newProduct.stockMinimo}
                    onChange={(e) => setNewProduct({ ...newProduct, stockMinimo: Number(e.target.value) })}
                    min={0}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                SKU generado: <span className="font-mono">{newProduct.producto}/{newProduct.presentacion}/{newProduct.sabor}</span>
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddProduct(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAddProduct} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors">
                  Guardar Producto
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
            <button onClick={() => setShowAddPaquete(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">Nuevo Paquete</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Selecciona productos del catálogo para armar el paquete.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre del Paquete *</label>
                <input
                  type="text"
                  value={newPaquete.nombre}
                  onChange={(e) => setNewPaquete({ ...newPaquete, nombre: e.target.value })}
                  placeholder="Ej: Paquete Premium"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Precio (S/)</label>
                  <input
                    type="number"
                    value={newPaquete.precioUnitario || ""}
                    onChange={(e) => setNewPaquete({ ...newPaquete, precioUnitario: Number(e.target.value) })}
                    placeholder="0 = a cotizar"
                    min={0}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
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
                          setNewPaquete({ ...newPaquete, contenidoItems: items });
                        }}
                      />
                      <input
                        type="number"
                        value={item.cantidad || ""}
                        onChange={(e) => {
                          const items = [...newPaquete.contenidoItems];
                          items[idx] = { ...items[idx], cantidad: Number(e.target.value) };
                          setNewPaquete({ ...newPaquete, contenidoItems: items });
                        }}
                        placeholder="Cant."
                        min={0}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                      />
                      {newPaquete.contenidoItems.length > 1 && (
                        <button
                          onClick={() => {
                            setNewPaquete({
                              ...newPaquete,
                              contenidoItems: newPaquete.contenidoItems.filter((_, i) => i !== idx),
                            });
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
                    setNewPaquete({
                      ...newPaquete,
                      contenidoItems: [...newPaquete.contenidoItems, { productoSku: "", productoNombre: "", cantidad: 0 }],
                    })
                  }
                  className="mt-2 text-sm text-[#EF8022] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Agregar producto al paquete
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddPaquete(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAddPaquete} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors">
                  Guardar Paquete
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
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Modelo *</label>
                  <select
                    value={newCarrito.modelo}
                    onChange={(e) => setNewCarrito({ ...newCarrito, modelo: e.target.value as Carrito["modelo"] })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="Blanco">Blanco</option>
                    <option value="Clásico">Clásico</option>
                    <option value="Delgado">Delgado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Código *</label>
                  <input
                    type="text"
                    value={newCarrito.codigo}
                    onChange={(e) => setNewCarrito({ ...newCarrito, codigo: e.target.value })}
                    placeholder="Ej: CRT-001"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción *</label>
                <textarea
                  value={newCarrito.descripcion}
                  onChange={(e) => setNewCarrito({ ...newCarrito, descripcion: e.target.value })}
                  placeholder="Ej: Carrito para eventos corporativos"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cantidad Total *</label>
                  <input
                    type="number"
                    value={newCarrito.cantidadTotal}
                    onChange={(e) => setNewCarrito({ ...newCarrito, cantidadTotal: Number(e.target.value) })}
                    min={1}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
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
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddCarrito(false)} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAddCarrito} className="flex-1 bg-[#EF8022] text-white px-4 py-3 rounded-lg hover:bg-[#d9711c] transition-colors">
                  Guardar Carrito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
