import type {
  Category,
  Product,
  Paquete,
  PaqueteItem,
  Carrito,
  Inflable,
  Personal,
  Recurso,
} from "../contexts/ProductsContext";

type ApiCategory = {
  id: number;
  nombre: string;
};

type ApiProductFlat = {
  id: number;
  categoria_id: number;
  producto: string;
  sku: string;
  precio?: number | null;
  brand?: "donofrio" | "jugueton" | null;
};

type ApiRecurso = {
  id: number;
  recurso: string;
  sku: string;
  precio?: number | null;
  brand: "donofrio" | "jugueton";
  stock_actual?: number | null;
  stock_minimo?: number | null;
};

type ApiPaquete = {
  id: number;
  nombre: string;
  precio_unitario: number;
  tipo: string;
  brand: "donofrio" | "jugueton";
  contenido?: Array<{
    producto_sku: string;
    producto_nombre: string;
    cantidad: number;
  }>;
};

type ApiCarrito = {
  id: number;
  modelo: string;
  codigo: string;
  tipo_id: number;
  tipo_nombre: string;
  descripcion: string | null;
  precio_alquiler?: number | null;
  imagen_url?: string | null;
  estado: "disponible" | "en-uso" | "mantenimiento";
};

type ApiInflable = {
  id: number;
  tipo_id: number;
  tipo_nombre: string;
  codigo: string;
  estado: "disponible" | "en-uso" | "mantenimiento";
  dimensiones: string | null;
  edad_minima: string | null;
  precio_alquiler: number;
  imagen_url?: string | null;
};

type ApiPersonal = {
  id: number;
  // New fields
  nombre_completo?: string | null;
  dni?: string | null;
  fecha_nacimiento?: string | null;
  numero_telefono?: string | null;
  licencia?: string | null;
  foto_url?: string | null;
  // Legacy fields
  nombre?: string | null;
  celular?: string | null;
  rol: "chofer" | "apoyo";
  estado: "disponible" | "ocupado" | "descanso" | "en-ruta";
};

// Construye las categorías uniendo /products/categories (id, nombre) con /products
// (que sí confirma incluir `brand`), en vez de depender de los productos anidados
// que devuelve /products/categories.
export function mapApiCategoriesFromFlatProducts(
  apiCategories: ApiCategory[],
  apiProducts: ApiProductFlat[]
): Category[] {
  return apiCategories.map((category) => ({
    id: category.id,
    categoria: category.nombre,
    productos: apiProducts
      .filter((product) => product.categoria_id === category.id)
      .map((product) => ({
        id: product.id,
        producto: product.producto,
        sku: product.sku,
        precio: Number(product.precio || 0),
        brand: product.brand || "donofrio",
      })),
  }));
}

export function mapApiRecursos(apiRecursos: ApiRecurso[]): Recurso[] {
  return apiRecursos.map((r) => ({
    id: r.id,
    recurso: r.recurso,
    sku: r.sku,
    precio: Number(r.precio || 0),
    brand: r.brand,
    stockActual: Number(r.stock_actual || 0),
    stockMinimo: Number(r.stock_minimo || 0),
  }));
}

export function mapPaqueteItemToApi(item: PaqueteItem) {
  return {
    producto_sku: item.productoSku,
    producto_nombre: item.productoNombre,
    cantidad: item.cantidad,
  };
}

export function mapApiPaquetes(apiPaquetes: ApiPaquete[]): Paquete[] {
  return apiPaquetes.map((paquete) => ({
    id: paquete.id,
    nombre: paquete.nombre,
    precioUnitario: Number(paquete.precio_unitario || 0),
    tipo: paquete.tipo || "",
    brand: paquete.brand,
    contenido: (paquete.contenido || []).map((item) => ({
      productoSku: item.producto_sku,
      productoNombre: item.producto_nombre,
      cantidad: item.cantidad,
    })),
  }));
}

export function mapApiCarritos(apiCarritos: ApiCarrito[]): Carrito[] {
  return apiCarritos.map((carrito) => ({
    id: carrito.id,
    modelo: carrito.modelo,
    codigo: carrito.codigo,
    tipoId: carrito.tipo_id ?? 0,
    tipoNombre: carrito.tipo_nombre || "",
    descripcion: carrito.descripcion || "",
    precioAlquiler: Number(carrito.precio_alquiler || 0),
    imagenUrl: carrito.imagen_url || undefined,
    estado: carrito.estado,
  }));
}

export function mapApiInflables(apiInflables: ApiInflable[]): Inflable[] {
  return apiInflables.map((inflable) => ({
    id: inflable.id,
    tipoId: inflable.tipo_id ?? 0,
    tipoNombre: inflable.tipo_nombre || "",
    codigo: inflable.codigo || "",
    estado: inflable.estado,
    dimensiones: inflable.dimensiones || "",
    edadMinima: inflable.edad_minima || "",
    precioAlquiler: Number(inflable.precio_alquiler || 0),
    imagenUrl: inflable.imagen_url || "",
  }));
}


export function mapApiPersonal(apiPersonal: ApiPersonal[]): Personal[] {
  return apiPersonal.map((persona) => ({
    id: persona.id,
    nombre_completo: persona.nombre_completo || persona.nombre || "",
    dni: persona.dni || "",
    fecha_nacimiento: persona.fecha_nacimiento || "",
    numero_telefono: persona.numero_telefono || persona.celular || "",
    rol: persona.rol,
    estado: persona.estado === "en-ruta" ? "ocupado" : persona.estado,
    ...(persona.licencia ? { licencia: persona.licencia } : {}),
    ...(persona.foto_url ? { foto_url: persona.foto_url } : {}),
    // Preserve legacy fields if present
    ...(persona.nombre ? { nombre: persona.nombre } : {}),
    ...(persona.celular ? { celular: persona.celular } : {}),
  }));
}
