import { useState } from "react";
import { Search, Package, Plus, Filter, X, Layers, Trash2, ChevronDown, Check, ShoppingCart } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { useBrand } from "../contexts/BrandContext";
import { useProducts } from "../contexts/ProductsContext";
import type { PaqueteItem, Paquete, FlatProduct, Carrito } from "../contexts/ProductsContext";
import { Eye as EyeIcon } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"productos" | "paquetes" | "carritos">("productos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [currentPage, setCurrentPage] = useState(1);

  const { brand } = useBrand();
  const isReadOnly = brand === "jugueton";

  // ← shared context instead of local state
  const {
    categories,
    allProducts,
    presentations,
    addProduct,
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
  });

  // Package modal
  const [showAddPaquete, setShowAddPaquete] = useState(false);
  const [newPaquete, setNewPaquete] = useState({
    nombre: "",
    descripcion: "",
    tipo: "BASICO" as Paquete["tipo"],
    precioUnitario: 0,
    contenidoItems: [{ productoSku: "", productoNombre: "", cantidad: 0 }] as PaqueteItem[],
  });

  // Filter products
  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch =
      product.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sabor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Todas" || product.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter paquetes - solo mostrar paquetes de la marca actual
  const filteredPaquetes = paquetes.filter(
    (p) =>
      p.brand === brand &&
      (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination
  const displayItems = activeTab === "productos" ? filteredProducts : filteredPaquetes;
  const totalPages = Math.ceil(displayItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
      sku,
    });

    setShowAddProduct(false);
    setNewProduct({ categoria: "", nuevaCategoria: "", producto: "", presentacion: "", sabor: "" });
  };

  // Add paquete via context
  const handleAddPaquete = async () => {
    if (!newPaquete.nombre || !newPaquete.descripcion) return;
    await addPaquete({
      nombre: newPaquete.nombre,
      descripcion: newPaquete.descripcion,
      tipo: newPaquete.tipo,
      precioUnitario: newPaquete.precioUnitario,
      contenido: newPaquete.contenidoItems.filter((i) => i.productoSku && i.cantidad > 0),
      brand: brand as "donofrio" | "jugueton",
    });
    setShowAddPaquete(false);
    setNewPaquete({
      nombre: "",
      descripcion: "",
      tipo: "BASICO",
      precioUnitario: 0,
      contenidoItems: [{ productoSku: "", productoNombre: "", cantidad: 0 }],
    });
  };

  const getPaqueteColor = (tipo: string) => {
    switch (tipo) {
      case "BASICO":
        return "bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 text-[#1F3C8B] dark:text-blue-400";
      case "PERSONALIZADO":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400";
      case "100 MINIS":
        return "bg-[#EF8022]/10 dark:bg-[#EF8022]/20 text-[#EF8022]";
      case "VACILÓN":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
    }
  };

  const getTotalHelados = (contenido: PaqueteItem[]) =>
    contenido.reduce((s, i) => s + i.cantidad, 0);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Catálogo de Productos</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona helados individuales y paquetes para eventos
        </p>
      </div>

      {/* Read-only banner for Juguetón */}
      {isReadOnly && (
        <div className="mb-6 flex items-center gap-3 bg-[#EF8022]/10 dark:bg-[#EF8022]/20 border border-[#EF8022]/30 rounded-xl px-5 py-3">
          <EyeIcon className="w-5 h-5 text-[#EF8022] shrink-0" />
          <p className="text-sm text-[#EF8022]">
            Modo consulta &mdash; Estás viendo el catálogo de D'Onofrio desde Jugueton. No puedes
            agregar ni eliminar productos.
          </p>
        </div>
      )}

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
          Helados Individuales
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
          Paquetes de Helados
        </button>
        {brand === "donofrio" && (
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
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
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
          <p className="text-3xl text-gray-900 dark:text-white">{paquetes.filter(p => p.brand === brand).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              {brand === "donofrio" ? (
                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {brand === "donofrio" ? "Carritos" : "Presentaciones"}
            </span>
          </div>
          <p className="text-3xl text-gray-900 dark:text-white">
            {brand === "donofrio" ? carritos.length : presentations.length}
          </p>
        </div>
      </div>

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
                {!isReadOnly && (
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Producto
                  </button>
                )}
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
                    <th className="px-6 py-4 text-left text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">SKU</th>
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
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-500 text-sm font-mono">{product.sku}</td>
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
              {!isReadOnly && (
                <button
                  onClick={() => setShowAddPaquete(true)}
                  className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Paquete
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPaquetes.map((paq) => (
              <div key={paq.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-gray-900 dark:text-white mb-1">{paq.nombre}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${getPaqueteColor(paq.tipo)}`}>
                      {paq.tipo}
                    </span>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={() => deletePaquete(paq.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{paq.descripcion}</p>

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

      {/* ── CARRITOS TAB (solo Donofrio) ───────────────────────── */}
      {activeTab === "carritos" && brand === "donofrio" && (
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
                onClick={() => alert("Función de agregar carrito próximamente")}
                className="bg-[#EF8022] text-white px-6 py-3 rounded-lg hover:bg-[#d9711c] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Nuevo Carrito
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {carritos
              .filter((c) => 
                c.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((carrito) => {
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

          {carritos.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No hay carritos registrados</p>
            </div>
          )}
        </>
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
              <div className="grid grid-cols-2 gap-4">
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
            <h3 className="text-xl text-gray-900 dark:text-white mb-2">Nuevo Paquete de Helados</h3>
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
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción *</label>
                <textarea
                  value={newPaquete.descripcion}
                  onChange={(e) => setNewPaquete({ ...newPaquete, descripcion: e.target.value })}
                  placeholder="Ej: 120 helados variados con carrito"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                  <select
                    value={newPaquete.tipo}
                    onChange={(e) => setNewPaquete({ ...newPaquete, tipo: e.target.value as Paquete["tipo"] })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EF8022]"
                  >
                    <option value="BASICO">Básico</option>
                    <option value="100 MINIS">100 Minis</option>
                    <option value="VACILÓN">Vacilón</option>
                    <option value="PERSONALIZADO">Personalizado</option>
                  </select>
                </div>
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
    </div>
  );
}
