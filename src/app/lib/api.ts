import { clearAuthSession, getAuthToken, getAuthUser, isAdminRole } from "./auth";
import { notify } from "./notify";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api") as string;

export class ApiError extends Error {
  status: number;
  body: unknown;
  /** Código de la petición en el log del servidor (X-Request-Id) */
  requestId?: string;
  constructor(message: string, status: number, body: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.requestId = requestId || undefined;
  }
}

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  /** No mostrar aviso ante un 403 (p. ej. limpiezas en segundo plano que ya manejan su error) */
  silencioso?: boolean;
};

export const SESION_EXPIRADA_KEY = "sesionExpirada";

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, silencioso = false, headers, ...rest } = options;
  const isPublicAuthRoute = /^\/auth\/(login|register|google)(?:$|[/?#])/.test(path);
  const shouldSkipAuth = skipAuth || isPublicAuthRoute;
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
      ...(shouldSkipAuth || !token ? {} : { Authorization: `Bearer ${token}` }),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    // Con varias peticiones en vuelo, solo la primera en recibir 401 cierra la sesión y redirige
    if (response.status === 401 && getAuthToken()) {
      // La pantalla de inicio de sesión explica por qué se volvió ahí
      try { sessionStorage.setItem(SESION_EXPIRADA_KEY, "1"); } catch { /* sin almacenamiento */ }
      clearAuthSession();
      localStorage.removeItem("selectedBrand");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    // Aviso flotante (antes un alert bloqueante); el id evita apilar varios si fallan varias peticiones
    if (response.status === 403 && !silencioso) {
      notify.error(new ApiError(String((body as { error?: unknown })?.error ?? ""), 403, body), undefined, { id: "sin-permiso" });
    }

    const errorMessage = (body && typeof body === "object" && "error" in body)
      ? String((body as { error: unknown }).error)
      : `HTTP ${response.status}`;
    throw new ApiError(errorMessage, response.status, body, response.headers.get("X-Request-Id") ?? undefined);
  }

  return body as T;
}

export function getCurrentBrand(): "donofrio" | "jugueton" {
  const authUser = getAuthUser();
  if (authUser?.brand && !isAdminRole(authUser.rol)) {
    return authUser.brand;
  }

  const stored = localStorage.getItem("selectedBrand");
  if (stored === "jugueton") return "jugueton";
  return "donofrio";
}

const TIPOS_PERMITIDOS = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;
const TAMANO_MAXIMO = 10 * 1024 * 1024; // igual que el límite del backend

/**
 * Sube un archivo (comprobante o imagen) enviando la sesión. Valida tipo y tamaño antes de subir
 * para dar un mensaje claro en vez de un error del servidor.
 */
export async function apiUpload(file: File, folder: string): Promise<{ url: string; path: string }> {
  if (!TIPOS_PERMITIDOS.test(file.type)) {
    throw new ApiError("Solo se pueden subir imágenes (JPG, PNG, WEBP) o PDF.", 400, null);
  }
  if (file.size > TAMANO_MAXIMO) {
    throw new ApiError("El archivo es demasiado grande (máximo 10 MB).", 413, null);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    throw new ApiError(String(data?.error || `HTTP ${response.status}`), response.status, data, response.headers.get("X-Request-Id") ?? undefined);
  }

  const rawUrl: string = data?.url || data?.fileUrl || data?.secure_url || data?.location || data?.data?.url || "";
  const rawPath: string = data?.path || data?.filePath || data?.data?.path || extraerRutaDeStorage(rawUrl);
  if (!rawUrl || !rawPath) {
    throw new ApiError("No se pudo guardar el archivo. Inténtalo de nuevo.", 500, data);
  }
  const url = rawUrl.startsWith("/") ? `${new URL(API_BASE_URL, window.location.origin).origin}${rawUrl}` : rawUrl;
  return { url, path: rawPath };
}

/** Ruta interna del archivo en el storage a partir de su URL pública */
export function extraerRutaDeStorage(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}
