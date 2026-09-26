import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiRequest } from "../lib/api";
import { AUTH_CHANGED_EVENT, isAuthenticated, isDriverUser } from "../lib/auth";
import {
  mapApiCarritos,
  mapApiCategoriesFromFlatProducts,
  mapApiInflables,
  mapApiPaquetes,
  mapApiPersonal,
  mapApiRecursos,
  mapInflableIncluidoToApi,
  mapPaqueteItemToApi,
} from "../lib/mappers";

export interface Product {
  id: number;
  producto: string;
  sku: string;
  precio: number;
  brand: "donofrio" | "jugueton";
}

export interface Recurso {
  id: number;
  recurso: string;
  sku: string;
  precio: number;
  brand: "donofrio" | "jugueton";
  stockActual: number;
  stockMinimo: number;
}

export interface RecursoStockMovement {
  id: number;
  recursoId: number;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo: string;
  stockAnterior: number;
  stockNuevo: number;
  createdAt: string;
}

export interface Category {
  id: number;
  categoria: string;
  productos: Product[];
}

export interface FlatProduct extends Product {
  categoria: string;
}

export interface PaqueteItem {
  productoSku: string;
  productoNombre: string;
  cantidad: number;
}

// Un cupo de inflable(s) que ya viene incluido (sin costo) en el precio del paquete.
// tipoIds con más de un elemento representa "1 inflable a elección entre estos tipos".
export interface PaqueteInflableIncluido {
  tipoIds: number[];
  cantidad: number;
}

export interface Paquete {
  id: number;
  nombre: string;
  contenido: PaqueteItem[];
  inflablesIncluidos: PaqueteInflableIncluido[];
  precioUnitario: number;
  tipo: string;
  brand: "donofrio" | "jugueton";
}

export interface PaqueteInput {
  nombre: string;
  contenido: PaqueteItem[];
  inflablesIncluidos: PaqueteInflableIncluido[];
  precioUnitario: number;
  tipo: string;
  brand: "donofrio" | "jugueton";
}

export interface Carrito {
  id: number;
  modelo: string;
  codigo: string;
  tipoId: number;
  tipoNombre: string;
  descripcion: string;
  precioAlquiler?: number;
  imagenUrl?: string;
  estado: "disponible" | "en-uso" | "mantenimiento";
}

export interface Inflable {
  id: number;
  tipoId: number;
  tipoNombre: string;
  codigo: string;
  estado: "disponible" | "en-uso" | "mantenimiento";
  dimensiones: string;
  edadMinima: string;
  precioAlquiler: number;
  imagenUrl: string;
}

export interface InflableTipo {
  id: number;
  nombre: string;
  descripcion: string;
  dimensiones: string;
  edadMinima: string;
  precioAlquiler: number;
  imagenUrl: string;
  imagenes: Array<{ id: number | null; url: string }>;
  cantidadUnidades: number;
}

export interface InflableImage {
  id: number;
  tipoId: number;
  imageUrl: string;
}

export interface Personal {
  id: number;
  nombre_completo: string;
  dni: string;
  fecha_nacimiento: string;
  numero_telefono: string;
  rol: "chofer" | "apoyo";
  estado: "disponible" | "ocupado" | "descanso";
  licencia?: string;
  foto_url?: string;
  // Legacy fields from older API responses
  nombre?: string;
  celular?: string;
}

function isValidPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^[+\d\s-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function buildChoferPayload(
  data: Partial<Omit<Personal, "id" | "nombre" | "celular">>,
  mode: "create" | "update"
) {
  const nombre = data.nombre_completo?.trim();
  const dni = data.dni?.trim();
  const telefono = data.numero_telefono?.trim();
  const licencia = data.licencia?.trim();

  if (mode === "create") {
    if (!nombre) throw new Error("El nombre completo es obligatorio para chofer.");
    if (!dni || !/^\d{8}$/.test(dni)) throw new Error("El DNI del chofer debe tener 8 dígitos.");
    if (!telefono || !isValidPhoneNumber(telefono)) {
      throw new Error("El teléfono del chofer debe tener entre 7 y 15 dígitos (admite +, espacios y guiones).");
    }
    if (!licencia) throw new Error("La licencia es obligatoria para chofer.");

    return {
      rol: "chofer" as const,
      nombre_completo: nombre,
      dni,
      numero_telefono: telefono,
      licencia,
    };
  }

  if (!licencia) throw new Error("La licencia es obligatoria para editar un chofer.");
  if (!telefono || !isValidPhoneNumber(telefono)) {
    throw new Error("El teléfono del chofer debe tener entre 7 y 15 dígitos (admite +, espacios y guiones).");
  }
  if (dni && !/^\d{8}$/.test(dni)) throw new Error("El DNI del chofer debe tener 8 dígitos.");

  return {
    ...(nombre !== undefined ? { nombre_completo: nombre } : {}),
    ...(dni !== undefined ? { dni } : {}),
    numero_telefono: telefono,
    licencia,
  };
}

interface ProductsContextType {
  categories: Category[];
  allProducts: FlatProduct[];
  addProduct: (catName: string, product: Omit<Product, "id">, categoriaId?: number) => Promise<void>;
  updateProduct: (id: number, catName: string, product: Omit<Product, "id">, categoriaId?: number) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  recursos: Recurso[];
  addRecurso: (recurso: Omit<Recurso, "id">) => Promise<void>;
  updateRecursoStock: (id: number, payload: { stockActual: number; stockMinimo?: number; motivo?: string }) => Promise<void>;
  getRecursoStockMovements: (id: number) => Promise<RecursoStockMovement[]>;
  deleteRecurso: (id: number) => Promise<void>;

  paquetes: Paquete[];
  addPaquete: (paquete: PaqueteInput) => Promise<void>;
  updatePaquete: (id: number, paquete: PaqueteInput) => Promise<void>;
  deletePaquete: (id: number) => Promise<void>;

  carritos: Carrito[];
  addCarrito: (carrito: Omit<Carrito, "id">) => Promise<void>;
  updateCarrito: (id: number, carrito: Omit<Carrito, "id">) => Promise<void>;
  updateCarritoEstado: (id: number, estado: Carrito["estado"]) => Promise<void>;
  deleteCarrito: (id: number) => Promise<void>;

  inflables: Inflable[];
  addInflable: (inflable: Omit<Inflable, "id">) => Promise<void>;
  deleteInflable: (id: number) => Promise<void>;
  addInflableTipo: (tipo: Omit<InflableTipo, "id" | "cantidadUnidades">) => Promise<void>;
  updateInflableTipo: (id: number, tipo: Omit<InflableTipo, "id" | "cantidadUnidades">) => Promise<void>;
  deleteInflableTipo: (id: number) => Promise<void>;
  getInflableImages: (tipoId: number) => Promise<InflableImage[]>;
  addInflableImage: (tipoId: number, imageUrl: string) => Promise<void>;
  deleteInflableImage: (tipoId: number, imageId: number) => Promise<void>;

  personales: Personal[];
  addPersonal: (personal: Omit<Personal, "id" | "nombre" | "celular">) => Promise<void>;
  updatePersonal: (
    id: number,
    data: Partial<Omit<Personal, "id" | "nombre" | "celular">>,
    existingRole?: Personal["rol"]
  ) => Promise<void>;
  updatePersonalEstado: (id: number, estado: Personal["estado"]) => Promise<void>;
  deletePersonal: (id: number) => Promise<void>;

  productNames: string[];
  /** Sin argumentos recarga todo; con partes, solo esos catálogos */
  reloadData: (...partes: ParteCatalogo[]) => Promise<void>;
  isLoadingData: boolean;
}

export type ParteCatalogo = "productos" | "paquetes" | "carritos" | "inflables" | "personal" | "recursos";
const TODAS_LAS_PARTES: ParteCatalogo[] = ["productos", "paquetes", "carritos", "inflables", "personal", "recursos"];

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [carritos, setCarritos] = useState<Carrito[]>([]);
  const [inflables, setInflables] = useState<Inflable[]>([]);
  const [personales, setPersonales] = useState<Personal[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Recarga solo los catálogos indicados: un cambio en un carrito ya no vuelve a pedir
  // productos, paquetes, inflables, personal y recursos.
  const reloadData = async (...partes: ParteCatalogo[]) => {
    const pedir = new Set<ParteCatalogo>(partes.length ? partes : TODAS_LAS_PARTES);
    const cargar = async (parte: ParteCatalogo, tarea: () => Promise<void>) => {
      if (!pedir.has(parte)) return;
      try {
        await tarea();
      } catch (error) {
        console.error(`No se pudo cargar el catálogo de ${parte}:`, error);
      }
    };

    await Promise.all([
      cargar("productos", async () => {
        const [cats, prods] = await Promise.all([
          apiRequest<unknown[]>("/products/categories"),
          apiRequest<unknown[]>("/products"),
        ]);
        setCategories(mapApiCategoriesFromFlatProducts(cats as never, prods as never));
      }),
      cargar("paquetes", async () => setPaquetes(mapApiPaquetes((await apiRequest<unknown[]>("/paquetes")) as never))),
      cargar("carritos", async () => setCarritos(mapApiCarritos((await apiRequest<unknown[]>("/carritos")) as never))),
      cargar("inflables", async () => setInflables(mapApiInflables((await apiRequest<unknown[]>("/inflables")) as never))),
      cargar("personal", async () => setPersonales(mapApiPersonal((await apiRequest<unknown[]>("/personal")) as never))),
      cargar("recursos", async () => setRecursos(mapApiRecursos((await apiRequest<unknown[]>("/recursos")) as never))),
    ]);

    setIsLoadingData(false);
  };

  useEffect(() => {
    // El provider se monta una sola vez (también en /login), así que hay que volver a cargar
    // al iniciar sesión; sin sesión no se pide nada para no disparar 401 en cadena.
    const cargarSiHaySesion = () => {
      // El chofer no usa el catálogo: no se le carga
      if (!isAuthenticated() || isDriverUser()) return;
      reloadData().catch((error) => {
        console.error("No se pudo cargar data de productos:", error);
      });
    };
    cargarSiHaySesion();
    window.addEventListener(AUTH_CHANGED_EVENT, cargarSiHaySesion);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, cargarSiHaySesion);
  }, []);

  const allProducts = useMemo<FlatProduct[]>(
    () => categories.flatMap((cat) => cat.productos.map((prod) => ({ ...prod, categoria: cat.categoria }))),
    [categories]
  );

  const productNames = useMemo(() => {
    const names = allProducts.map((p) => p.producto);
    return [...new Set([...names, "Termo de helado (5L)", "Termo de helado (10L)"])];
  }, [allProducts]);

  const addProduct = async (catName: string, product: Omit<Product, "id">, categoriaId?: number) => {
    let category = categoriaId !== undefined
      ? categories.find((c) => c.id === categoriaId)
      : categories.find((c) => c.categoria.toLowerCase() === catName.toLowerCase());

    if (!category) {
      const createdCategory = await apiRequest<{ id: number }>("/products/categories", {
        method: "POST",
        body: JSON.stringify({ nombre: catName }),
      });
      category = { id: createdCategory.id, categoria: catName, productos: [] };
    }

    await apiRequest("/products", {
      method: "POST",
      body: JSON.stringify({
        categoria_id: category.id,
        producto: product.producto,
        sku: product.sku,
        precio: Number(product.precio || 0),
        brand: product.brand,
      }),
    });

    await reloadData("productos");
  };

  const updateProduct = async (id: number, catName: string, product: Omit<Product, "id">, categoriaId?: number) => {
    let category = categoriaId !== undefined
      ? categories.find((c) => c.id === categoriaId)
      : categories.find((c) => c.categoria.toLowerCase() === catName.toLowerCase());

    if (!category) {
      const createdCategory = await apiRequest<{ id: number }>("/products/categories", {
        method: "POST",
        body: JSON.stringify({ nombre: catName }),
      });
      category = { id: createdCategory.id, categoria: catName, productos: [] };
    }

    await apiRequest(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        id,
        categoria_id: category.id,
        producto: product.producto,
        precio: Number(product.precio || 0),
        sku: product.sku,
        brand: product.brand,
      }),
    });

    await reloadData("productos");
  };

  const deleteProduct = async (id: number) => {
    await apiRequest(`/products/${id}`, { method: "DELETE" });
    await reloadData("productos");
  };

  const addRecurso = async (recurso: Omit<Recurso, "id">) => {
    await apiRequest("/recursos", {
      method: "POST",
      body: JSON.stringify({
        recurso: recurso.recurso,
        sku: recurso.sku,
        precio: Number(recurso.precio || 0),
        brand: recurso.brand,
        stock_actual: Number(recurso.stockActual || 0),
        stock_minimo: Number(recurso.stockMinimo || 0),
      }),
    });
    await reloadData("recursos");
  };

  const updateRecursoStock = async (
    id: number,
    payload: { stockActual: number; stockMinimo?: number; motivo?: string }
  ) => {
    await apiRequest(`/recursos/${id}/stock`, {
      method: "PUT",
      body: JSON.stringify({
        stock_actual: payload.stockActual,
        ...(payload.stockMinimo !== undefined ? { stock_minimo: payload.stockMinimo } : {}),
        ...(payload.motivo ? { motivo: payload.motivo } : {}),
      }),
    });
    await reloadData("recursos");
  };

  const getRecursoStockMovements = async (id: number): Promise<RecursoStockMovement[]> => {
    const movements = await apiRequest<Array<{
      id: number;
      recurso_id: number;
      tipo: "entrada" | "salida" | "ajuste";
      cantidad: number;
      motivo?: string | null;
      stock_anterior?: number | null;
      stock_nuevo?: number | null;
      created_at?: string | null;
    }>>(`/recursos/${id}/stock/movements`);

    return movements.map((m) => ({
      id: m.id,
      recursoId: m.recurso_id,
      tipo: m.tipo,
      cantidad: Number(m.cantidad || 0),
      motivo: m.motivo || "Sin motivo",
      stockAnterior: Number(m.stock_anterior || 0),
      stockNuevo: Number(m.stock_nuevo || 0),
      createdAt: m.created_at || "",
    }));
  };

  const deleteRecurso = async (id: number) => {
    await apiRequest(`/recursos/${id}`, { method: "DELETE" });
    await reloadData("recursos");
  };

  const deleteCategory = async (id: number) => {
    await apiRequest(`/products/categories/${id}`, { method: "DELETE" });
    await reloadData("productos");
  };

  const addPaquete = async (paquete: PaqueteInput) => {
    await apiRequest("/paquetes", {
      method: "POST",
      body: JSON.stringify({
        nombre: paquete.nombre,
        precio_unitario: paquete.precioUnitario,
        tipo: paquete.tipo,
        brand: paquete.brand,
        contenido: paquete.contenido.map(mapPaqueteItemToApi),
        inflables_incluidos: paquete.inflablesIncluidos.map(mapInflableIncluidoToApi),
      }),
    });

    await reloadData("paquetes");
  };

  const updatePaquete = async (id: number, paquete: PaqueteInput) => {
    await apiRequest(`/paquetes/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        id,
        nombre: paquete.nombre,
        precio_unitario: paquete.precioUnitario,
        tipo: paquete.tipo,
        brand: paquete.brand,
        contenido: paquete.contenido.map(mapPaqueteItemToApi),
        inflables_incluidos: paquete.inflablesIncluidos.map(mapInflableIncluidoToApi),
      }),
    });
    await reloadData("paquetes");
  };

  const deletePaquete = async (id: number) => {
    await apiRequest(`/paquetes/${id}`, { method: "DELETE" });
    await reloadData("paquetes");
  };

  const addCarrito = async (carrito: Omit<Carrito, "id">) => {
    await apiRequest("/carritos", {
      method: "POST",
      body: JSON.stringify({
        modelo: carrito.modelo,
        codigo: carrito.codigo,
        tipo_id: carrito.tipoId,
        descripcion: carrito.descripcion,
        precio_alquiler: Number(carrito.precioAlquiler || 0),
        estado: carrito.estado,
      }),
    });
    await reloadData("carritos");
  };

  const updateCarrito = async (id: number, carrito: Omit<Carrito, "id">) => {
    await apiRequest(`/carritos/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        modelo: carrito.modelo,
        codigo: carrito.codigo,
        tipo_id: carrito.tipoId,
        descripcion: carrito.descripcion,
        precio_alquiler: Number(carrito.precioAlquiler || 0),
        estado: carrito.estado,
      }),
    });
    await reloadData("carritos");
  };

  const updateCarritoEstado = async (id: number, estado: Carrito["estado"]) => {
    await apiRequest(`/carritos/${id}`, {
      method: "PUT",
      body: JSON.stringify({ estado }),
    });
    await reloadData("carritos");
  };

  const deleteCarrito = async (id: number) => {
    await apiRequest(`/carritos/${id}`, { method: "DELETE" });
    await reloadData("carritos");
  };

  const addInflable = async (inflable: Omit<Inflable, "id">) => {
    await apiRequest("/inflables", {
      method: "POST",
      body: JSON.stringify({
        tipo_id: inflable.tipoId,
        codigo: inflable.codigo,
        estado: inflable.estado,
      }),
    });
    await reloadData("inflables");
  };

  const deleteInflable = async (id: number) => {
    await apiRequest(`/inflables/${id}`, { method: "DELETE" });
    await reloadData("inflables");
  };

  const addInflableTipo = async (tipo: Omit<InflableTipo, "id" | "cantidadUnidades">) => {
    await apiRequest("/inflables/tipos", {
      method: "POST",
      body: JSON.stringify({
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        precio_alquiler: tipo.precioAlquiler,
        dimensiones: tipo.dimensiones,
        edad_minima: tipo.edadMinima,
        imagen_url: tipo.imagenUrl,
        imagenes: tipo.imagenes.map((img) => img.url),
      }),
    });
    await reloadData("inflables");
  };

  const updateInflableTipo = async (id: number, tipo: Omit<InflableTipo, "id" | "cantidadUnidades">) => {
    await apiRequest(`/inflables/tipos/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        precio_alquiler: tipo.precioAlquiler,
        dimensiones: tipo.dimensiones,
        edad_minima: tipo.edadMinima,
        imagen_url: tipo.imagenUrl,
      }),
    });
    await reloadData("inflables");
  };

  const deleteInflableTipo = async (id: number) => {
    await apiRequest(`/inflables/tipos/${id}`, { method: "DELETE" });
    await reloadData("inflables", "paquetes");
  };

  const getInflableImages = async (tipoId: number): Promise<InflableImage[]> => {
    const images = await apiRequest<Array<{
      id: number;
      tipo_id: number;
      image_url: string;
    }>>(`/inflables/tipos/${tipoId}/images`);
    return images.map((image) => ({
      id: image.id,
      tipoId: image.tipo_id,
      imageUrl: image.image_url,
    }));
  };

  const addInflableImage = async (tipoId: number, imageUrl: string) => {
    await apiRequest(`/inflables/tipos/${tipoId}/images`, {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl }),
    });
    await reloadData("inflables");
  };

  const deleteInflableImage = async (tipoId: number, imageId: number) => {
    await apiRequest(`/inflables/tipos/${tipoId}/images/${imageId}`, { method: "DELETE" });
    await reloadData("inflables");
  };

  const addPersonal = async (personal: Omit<Personal, "id" | "nombre" | "celular">) => {
    const payload = personal.rol === "chofer"
      ? buildChoferPayload(personal, "create")
      : {
          nombre_completo: personal.nombre_completo,
          dni: personal.dni,
          fecha_nacimiento: personal.fecha_nacimiento,
          numero_telefono: personal.numero_telefono,
          rol: personal.rol,
          estado: personal.estado,
          ...(personal.licencia ? { licencia: personal.licencia } : {}),
          ...(personal.foto_url ? { foto_url: personal.foto_url } : {}),
        };

    await apiRequest("/personal", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await reloadData("personal");
  };

  const updatePersonal = async (
    id: number,
    data: Partial<Omit<Personal, "id" | "nombre" | "celular">>,
    existingRole?: Personal["rol"]
  ) => {
    const targetRole = data.rol ?? existingRole;
    const payload = targetRole === "chofer"
      ? buildChoferPayload(data, "update")
      : {
          ...(data.nombre_completo !== undefined ? { nombre_completo: data.nombre_completo } : {}),
          ...(data.dni !== undefined ? { dni: data.dni } : {}),
          ...(data.fecha_nacimiento !== undefined ? { fecha_nacimiento: data.fecha_nacimiento } : {}),
          ...(data.numero_telefono !== undefined ? { numero_telefono: data.numero_telefono } : {}),
          ...(data.rol !== undefined ? { rol: data.rol } : {}),
          ...(data.estado !== undefined ? { estado: data.estado } : {}),
          ...(data.licencia !== undefined ? { licencia: data.licencia } : {}),
          ...(data.foto_url !== undefined ? { foto_url: data.foto_url } : {}),
        };

    await apiRequest(`/personal/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    await reloadData("personal");
  };

  const updatePersonalEstado = async (id: number, estado: Personal["estado"]) => {
    await apiRequest(`/personal/${id}`, {
      method: "PUT",
      body: JSON.stringify({ estado }),
    });
    await reloadData("personal");
  };

  const deletePersonal = async (id: number) => {
    await apiRequest(`/personal/${id}`, { method: "DELETE" });
    await reloadData("personal");
  };

  return (
    <ProductsContext.Provider
      value={{
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
        inflables,
        addInflable,
        deleteInflable,
        addInflableTipo,
        updateInflableTipo,
        deleteInflableTipo,
        getInflableImages,
        addInflableImage,
        deleteInflableImage,
        personales,
        addPersonal,
        updatePersonal,
        updatePersonalEstado,
        deletePersonal,
        productNames,
        reloadData,
        isLoadingData,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error("useProducts must be used within ProductsProvider");
  }
  return context;
}
