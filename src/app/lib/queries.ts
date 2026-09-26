import { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "./api";
import { AUTH_CHANGED_EVENT } from "./auth";

// Caché compartida entre páginas: si Fichas ya cargó los datos, Pagos o Inflables los reutilizan
// en vez de volver a pedirlos, y dos pedidos simultáneos del mismo dato salen como uno solo.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s se reutiliza lo cargado sin volver a pedirlo
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Los datos dependen del usuario: al iniciar o cerrar sesión se descarta todo
if (typeof window !== "undefined") {
  window.addEventListener(AUTH_CHANGED_EVENT, () => queryClient.clear());
}

export const claves = {
  fichas: ["fichas"] as const,
  fichasConDetalle: (brand: string) => ["fichas", brand, "detalle"] as const,
  fichasLista: (brand: string) => ["fichas", brand, "lista"] as const,
  clientes: (brand?: string) => ["clientes", brand ?? "todas"] as const,
  tarifasEnvio: ["tarifas-envio"] as const,
};

type Opciones = { forzar?: boolean };

// Todas las fichas de la marca con paquetes, carritos, inflables, personal, abonos y recursos,
// en una sola petición (antes: una petición por ficha).
export function obtenerFichasConDetalle<T = any>(brand: string, { forzar }: Opciones = {}) {
  return queryClient.fetchQuery({
    queryKey: claves.fichasConDetalle(brand),
    queryFn: () => apiRequest<T[]>(`/fichas?brand=${brand}&detalle=1`),
    ...(forzar ? { staleTime: 0 } : {}),
  });
}

// Solo los datos de cada ficha (sin líneas); más liviano para listados y conteos
export function obtenerFichasLista<T = any>(brand: string, { forzar }: Opciones = {}) {
  return queryClient.fetchQuery({
    queryKey: claves.fichasLista(brand),
    queryFn: () => apiRequest<T[]>(`/fichas?brand=${brand}`),
    ...(forzar ? { staleTime: 0 } : {}),
  });
}

export function obtenerClientes<T = any>(brand?: string, { forzar }: Opciones = {}) {
  return queryClient.fetchQuery({
    queryKey: claves.clientes(brand),
    queryFn: () => apiRequest<T[]>(brand ? `/clients?brand=${brand}` : "/clients"),
    ...(forzar ? { staleTime: 0 } : {}),
  });
}

// Las tarifas casi no cambian: se reutilizan por 10 minutos
export function obtenerTarifasEnvio<T = any>() {
  return queryClient.fetchQuery({
    queryKey: claves.tarifasEnvio,
    queryFn: () => apiRequest<T[]>("/tarifas-envio"),
    staleTime: 10 * 60_000,
  });
}

// Tras crear, editar o borrar una ficha o un abono: todo lo derivado de fichas queda viejo
// y la próxima página que lo pida lo vuelve a cargar.
export function invalidarFichas() {
  return queryClient.invalidateQueries({ queryKey: claves.fichas });
}

export function invalidarClientes() {
  return queryClient.invalidateQueries({ queryKey: ["clientes"] });
}

// Reemplaza una ficha (detalle completo devuelto por la API) dentro de la caché con detalle,
// para no recargar todas por un cambio en una sola. Las demás vistas de fichas se invalidan.
export function reemplazarFichaEnCache(brand: string, ficha: { id: number } & Record<string, unknown>) {
  queryClient.setQueryData<any[]>(claves.fichasConDetalle(brand), (prev) => {
    if (!prev) return prev;
    const existe = prev.some((f) => f.id === ficha.id);
    return existe ? prev.map((f) => (f.id === ficha.id ? ficha : f)) : [ficha, ...prev];
  });
  void queryClient.invalidateQueries({ queryKey: claves.fichasLista(brand) });
}

export function quitarFichaDeCache(brand: string, fichaId: number) {
  queryClient.setQueryData<any[]>(claves.fichasConDetalle(brand), (prev) => prev?.filter((f) => f.id !== fichaId));
  void queryClient.invalidateQueries({ queryKey: claves.fichasLista(brand) });
}
