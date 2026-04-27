import type {
  Category,
  Product,
  Paquete,
  PaqueteItem,
  Carrito,
  Inflable,
  Personal,
} from "../contexts/ProductsContext";

type ApiCategory = {
  id: number;
  nombre: string;
  productos?: Array<{
    id: number;
    producto: string;
    sku: string;
    precio?: number | null;
    stock_actual?: number | null;
    stock_minimo?: number | null;
  }>;
};

type ApiPaquete = {
  id: number;
  nombre: string;
  precio_unitario: number;
  contenido?: Array<{
    producto_sku: string;
    producto_nombre: string;
    cantidad: number;
  }>;
};

type ApiCarrito = {
  id: number;
  modelo: "Blanco" | "Clásico" | "Delgado";
  codigo: string;
  descripcion: string | null;
  cantidad_total: number;
  estado: "disponible" | "en-uso" | "mantenimiento";
};

type ApiInflable = {
  id: number;
  nombre: string;
  descripcion: string | null;
  cantidad_total: number;
  precio_alquiler: number;
  dimensiones: string | null;
  edad_minima: string | null;
  imagen_url?: string | null;
  imagenes?: Array<string | { id?: number; image_url?: string; url?: string }> | null;
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
  estado: "disponible" | "en-ruta" | "descanso";
};

export function mapApiCategories(apiCategories: ApiCategory[]): Category[] {
  return apiCategories.map((category) => ({
    id: category.id,
    categoria: category.nombre,
    productos: (category.productos || []).map((product) => ({
      id: product.id,
      producto: product.producto,
      sku: product.sku,
      precio: Number(product.precio || 0),
      stockActual: Number(product.stock_actual || 0),
      stockMinimo: Number(product.stock_minimo || 0),
    })),
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
    descripcion: carrito.descripcion || "",
    cantidadTotal: carrito.cantidad_total,
    estado: carrito.estado,
  }));
}

export function mapApiInflables(apiInflables: ApiInflable[]): Inflable[] {
  return apiInflables.map((inflable) => ({
    id: inflable.id,
    nombre: inflable.nombre,
    descripcion: inflable.descripcion || "",
    cantidadTotal: inflable.cantidad_total,
    precioAlquiler: Number(inflable.precio_alquiler || 0),
    dimensiones: inflable.dimensiones || "",
    edadMinima: inflable.edad_minima || "",
    imagenUrl: inflable.imagen_url || "",
    imagenes: Array.isArray(inflable.imagenes)
      ? inflable.imagenes
          .map((image) => {
            if (typeof image === "string") {
              return { id: null, url: image };
            }

            const url = image.image_url || image.url || "";
            if (!url) return null;
            return { id: typeof image.id === "number" ? image.id : null, url };
          })
          .filter((image): image is { id: number | null; url: string } => Boolean(image))
      : (inflable.imagen_url ? [{ id: null, url: inflable.imagen_url }] : []),
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
    estado: persona.estado,
    ...(persona.licencia ? { licencia: persona.licencia } : {}),
    ...(persona.foto_url ? { foto_url: persona.foto_url } : {}),
    // Preserve legacy fields if present
    ...(persona.nombre ? { nombre: persona.nombre } : {}),
    ...(persona.celular ? { celular: persona.celular } : {}),
  }));
}
