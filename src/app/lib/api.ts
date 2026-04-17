import { clearAuthSession, getAuthToken, getAuthUser, isAdminRole } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, headers, ...rest } = options;
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
    if (response.status === 401) {
      clearAuthSession();
      localStorage.removeItem("selectedBrand");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    if (response.status === 403) {
      const forbiddenMessage = (body && typeof body === "object" && "error" in body)
        ? String((body as { error: unknown }).error)
        : "No tienes permisos para acceder a esta marca o recurso.";
      if (typeof window !== "undefined") {
        window.alert(forbiddenMessage);
      }
    }

    const errorMessage = (body && typeof body === "object" && "error" in body)
      ? String((body as { error: unknown }).error)
      : `HTTP ${response.status}`;
    throw new Error(errorMessage);
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
