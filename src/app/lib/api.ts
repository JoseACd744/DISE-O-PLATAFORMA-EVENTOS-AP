import { getAuthToken } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, headers, ...rest } = options;
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
      ...(skipAuth || !token ? {} : { Authorization: `Bearer ${token}` }),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMessage = (body && typeof body === "object" && "error" in body)
      ? String((body as { error: unknown }).error)
      : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return body as T;
}

export function getCurrentBrand(): "donofrio" | "jugueton" {
  const stored = localStorage.getItem("selectedBrand");
  if (stored === "jugueton") return "jugueton";
  return "donofrio";
}
