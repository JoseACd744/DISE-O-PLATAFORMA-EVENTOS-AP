import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiRequest, getCurrentBrand } from "../lib/api";
import {
  mapApiCarritos,
  mapApiCategories,
  mapApiInflables,
  mapApiPaquetes,
  mapApiPersonal,
  mapPaqueteItemToApi,
} from "../lib/mappers";

export interface Product {
  id: number;
  producto: string;
  presentacion: string;
  sabor: string;
  sku: string;
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
  descripcion: string;
  contenido: PaqueteItem[];
  precioUnitario: number;
  tipo: "BASICO" | "100 MINIS" | "PERSONALIZADO" | "VACILÓN";
  brand: "donofrio" | "jugueton";
}

export interface Carrito {
  id: number;
  modelo: "Blanco" | "Clásico" | "Delgado";
  codigo: string;
  descripcion: string;
  cantidadTotal: number;
  estado: "disponible" | "en-uso" | "mantenimiento";
}

export interface Inflable {
  id: number;
  nombre: string;
  descripcion: string;
  cantidadTotal: number;
  precioAlquiler: number;
  dimensiones: string;
  edadMinima: string;
}

export interface Personal {
  id: number;
  nombre: string;
  celular: string;
  rol: "chofer" | "apoyo";
  estado: "disponible" | "en-ruta" | "descanso";
}

interface ProductsContextType {
  categories: Category[];
  allProducts: FlatProduct[];
  presentations: string[];
  addProduct: (catName: string, product: Omit<Product, "id">) => Promise<void>;

  paquetes: Paquete[];
  addPaquete: (paquete: Omit<Paquete, "id">) => Promise<void>;
  deletePaquete: (id: number) => Promise<void>;

  carritos: Carrito[];
  addCarrito: (carrito: Omit<Carrito, "id">) => Promise<void>;
  updateCarritoEstado: (id: number, estado: Carrito["estado"]) => Promise<void>;
  deleteCarrito: (id: number) => Promise<void>;

  inflables: Inflable[];
  addInflable: (inflable: Omit<Inflable, "id">) => Promise<void>;
  deleteInflable: (id: number) => Promise<void>;

  personales: Personal[];
  addPersonal: (personal: Omit<Personal, "id">) => Promise<void>;
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

  const reloadData = async () => {
    const selectedBrand = getCurrentBrand();
    const paquetesBrand = selectedBrand;
    const productsBrand = "donofrio";

    const [categoriesData, paquetesData, carritosData, inflablesData, personalData] = await Promise.all([
      apiRequest<unknown[]>(`/products/categories?brand=${productsBrand}`),
      apiRequest<unknown[]>(`/paquetes?brand=${paquetesBrand}`),
      apiRequest<unknown[]>("/carritos"),
      apiRequest<unknown[]>("/inflables"),
      apiRequest<unknown[]>("/personal"),
    ]);

    setCategories(mapApiCategories(categoriesData as never));
    setPaquetes(mapApiPaquetes(paquetesData as never));
    setCarritos(mapApiCarritos(carritosData as never));
    setInflables(mapApiInflables(inflablesData as never));
    setPersonales(mapApiPersonal(personalData as never));
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

  const presentations = useMemo(() => [...new Set(allProducts.map((p) => p.presentacion))], [allProducts]);

  const productNames = useMemo(() => {
    const names = allProducts.map((p) => {
      const suffix = p.presentacion !== "Mini" ? ` (${p.presentacion})` : "";
      return `${p.producto}${suffix}`;
    });
    return [...new Set([...names, "Termo de helado (5L)", "Termo de helado (10L)"])];
  }, [allProducts]);

  const addProduct = async (catName: string, product: Omit<Product, "id">) => {
    const brand = "donofrio";

    let category = categories.find((c) => c.categoria.toLowerCase() === catName.toLowerCase());

    if (!category) {
      const createdCategory = await apiRequest<{ id: number }>("/products/categories", {
        method: "POST",
        body: JSON.stringify({ nombre: catName, brand }),
      });
      category = { id: createdCategory.id, categoria: catName, productos: [] };
    }

    await apiRequest("/products", {
      method: "POST",
      body: JSON.stringify({
        categoria_id: category.id,
        producto: product.producto,
        presentacion: product.presentacion,
        sabor: product.sabor,
        sku: product.sku,
        brand,
      }),
    });

    await reloadData();
  };

  const addPaquete = async (paquete: Omit<Paquete, "id">) => {
    await apiRequest("/paquetes", {
      method: "POST",
      body: JSON.stringify({
        nombre: paquete.nombre,
        descripcion: paquete.descripcion,
        tipo: paquete.tipo,
        precio_unitario: paquete.precioUnitario,
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
        descripcion: carrito.descripcion,
        cantidad_total: carrito.cantidadTotal,
        precio_alquiler: 0,
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
        nombre: inflable.nombre,
        descripcion: inflable.descripcion,
        cantidad_total: inflable.cantidadTotal,
        precio_alquiler: inflable.precioAlquiler,
        dimensiones: inflable.dimensiones,
        edad_minima: inflable.edadMinima,
      }),
    });
    await reloadData();
  };

  const deleteInflable = async (id: number) => {
    await apiRequest(`/inflables/${id}`, { method: "DELETE" });
    await reloadData();
  };

  const addPersonal = async (personal: Omit<Personal, "id">) => {
    await apiRequest("/personal", {
      method: "POST",
      body: JSON.stringify({
        nombre: personal.nombre,
        celular: personal.celular,
        rol: personal.rol,
        estado: personal.estado,
      }),
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
        presentations,
        addProduct,
        paquetes,
        addPaquete,
        deletePaquete,
        carritos,
        addCarrito,
        updateCarritoEstado,
        deleteCarrito,
        inflables,
        addInflable,
        deleteInflable,
        personales,
        addPersonal,
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
