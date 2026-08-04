import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiRequest } from "../lib/api";
import {
  mapApiCarritos,
  mapApiCategories,
  mapApiInflables,
  mapApiPaquetes,
  mapApiPersonal,
  mapApiRecursos,
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

export interface Paquete {
  id: number;
  nombre: string;
  contenido: PaqueteItem[];
  precioUnitario: number;
  tipo: string;
  brand: "donofrio" | "jugueton";
}

export interface PaqueteInput {
  nombre: string;
  contenido: PaqueteItem[];
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
  addProduct: (catName: string, product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: number, catName: string, product: Omit<Product, "id">) => Promise<void>;
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
  reloadData: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [carritos, setCarritos] = useState<Carrito[]>([]);
  const [inflables, setInflables] = useState<Inflable[]>([]);
  const [personales, setPersonales] = useState<Personal[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);

  const reloadData = async () => {
    const [categoriesData, paquetesData, carritosData, inflablesData, personalData, recursosData] = await Promise.all([
      apiRequest<unknown[]>("/products/categories"),
      apiRequest<unknown[]>("/paquetes"),
      apiRequest<unknown[]>("/carritos"),
      apiRequest<unknown[]>("/inflables"),
      apiRequest<unknown[]>("/personal"),
      apiRequest<unknown[]>("/recursos"),
    ]);

    setCategories(mapApiCategories(categoriesData as never));
    setPaquetes(mapApiPaquetes(paquetesData as never));
    setCarritos(mapApiCarritos(carritosData as never));
    setInflables(mapApiInflables(inflablesData as never));
    setPersonales(mapApiPersonal(personalData as never));
    setRecursos(mapApiRecursos(recursosData as never));
  };

  useEffect(() => {
    reloadData().catch((error) => {
      console.error("No se pudo cargar data de productos:", error);
    });
  }, []);

  const allProducts = useMemo<FlatProduct[]>(
    () => categories.flatMap((cat) => cat.productos.map((prod) => ({ ...prod, categoria: cat.categoria }))),
    [categories]
  );

  const productNames = useMemo(() => {
    const names = allProducts.map((p) => p.producto);
    return [...new Set([...names, "Termo de helado (5L)", "Termo de helado (10L)"])];
  }, [allProducts]);

  const addProduct = async (catName: string, product: Omit<Product, "id">) => {
    let category = categories.find((c) => c.categoria.toLowerCase() === catName.toLowerCase());

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

    await reloadData();
  };

  const updateProduct = async (id: number, catName: string, product: Omit<Product, "id">) => {
    let category = categories.find((c) => c.categoria.toLowerCase() === catName.toLowerCase());

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

    await reloadData();
  };

  const deleteProduct = async (id: number) => {
    await apiRequest(`/products/${id}`, { method: "DELETE" });
    await reloadData();
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
    await reloadData();
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
    await reloadData();
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
    await reloadData();
  };

  const deleteCategory = async (id: number) => {
    await apiRequest(`/products/categories/${id}`, { method: "DELETE" });
    await reloadData();
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
      }),
    });

    await reloadData();
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
      }),
    });
    await reloadData();
  };

  const deletePaquete = async (id: number) => {
    await apiRequest(`/paquetes/${id}`, { method: "DELETE" });
    await reloadData();
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
    await reloadData();
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
    await reloadData();
  };

  const updateCarritoEstado = async (id: number, estado: Carrito["estado"]) => {
    await apiRequest(`/carritos/${id}`, {
      method: "PUT",
      body: JSON.stringify({ estado }),
    });
    await reloadData();
  };

  const deleteCarrito = async (id: number) => {
    await apiRequest(`/carritos/${id}`, { method: "DELETE" });
    await reloadData();
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
    await reloadData();
  };

  const deleteInflable = async (id: number) => {
    await apiRequest(`/inflables/${id}`, { method: "DELETE" });
    await reloadData();
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
    await reloadData();
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
    await reloadData();
  };

  const deleteInflableTipo = async (id: number) => {
    await apiRequest(`/inflables/tipos/${id}`, { method: "DELETE" });
    await reloadData();
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
    await reloadData();
  };

  const deleteInflableImage = async (tipoId: number, imageId: number) => {
    await apiRequest(`/inflables/tipos/${tipoId}/images/${imageId}`, { method: "DELETE" });
    await reloadData();
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
    await reloadData();
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
    await reloadData();
  };

  const updatePersonalEstado = async (id: number, estado: Personal["estado"]) => {
    await apiRequest(`/personal/${id}`, {
      method: "PUT",
      body: JSON.stringify({ estado }),
    });
    await reloadData();
  };

  const deletePersonal = async (id: number) => {
    await apiRequest(`/personal/${id}`, { method: "DELETE" });
    await reloadData();
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
