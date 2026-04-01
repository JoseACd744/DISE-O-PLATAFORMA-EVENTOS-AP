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
    presentacion: string;
    sabor: string;
    sku: string;
  }>;
};

type ApiPaquete = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_unitario: number;
  tipo: "BASICO" | "100 MINIS" | "PERSONALIZADO" | "VACILÓN";
  brand: "donofrio" | "jugueton";
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
};

type ApiPersonal = {
  id: number;
  nombre: string;
  celular: string | null;
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
      presentacion: product.presentacion,
      sabor: product.sabor,
      sku: product.sku,
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
    descripcion: paquete.descripcion || "",
    precioUnitario: Number(paquete.precio_unitario || 0),
    tipo: paquete.tipo,
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
  }));
}

export function mapApiPersonal(apiPersonal: ApiPersonal[]): Personal[] {
  return apiPersonal.map((persona) => ({
    id: persona.id,
    nombre: persona.nombre,
    celular: persona.celular || "",
    rol: persona.rol,
    estado: persona.estado,
  }));
}
