const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";
const AUTH_FLAG_KEY = "isAuthenticated";

export type AuthUser = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  brand: "donofrio" | "jugueton";
  created_at?: string;
};

export function setAuthSession(token: string, user: AuthUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_FLAG_KEY, "true");
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getUserRole() {
  return getAuthUser()?.rol?.toLowerCase() || "";
}

export function isAdminRole(role?: string) {
  if (!role) return false;
  return role.toLowerCase() === "admin";
}

export function isAdminUser() {
  return isAdminRole(getUserRole());
}

export function isDriverRole(role?: string) {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === "chofer" || normalized === "driver";
}

export function isDriverUser() {
  return isDriverRole(getUserRole());
}

export function isVendedorRole(role?: string) {
  if (!role) return false;
  return role.toLowerCase() === "vendedor";
}

export function isVendedorUser() {
  return isVendedorRole(getUserRole());
}

/** True if the current user can create/edit/delete on pages other than Fichas. */
export function canManageResources() {
  return true;
}

/** True if the current user can create/edit/delete clients for both brands. */
export function canManageClients() {
  return true;
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_FLAG_KEY);
}
