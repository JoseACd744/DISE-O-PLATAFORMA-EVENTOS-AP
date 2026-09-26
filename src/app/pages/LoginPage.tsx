import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { isDriverRole, setAuthSession } from "../lib/auth";
import { SESION_EXPIRADA_KEY } from "../lib/api";
import { mensajeDeError } from "../lib/notify";

const LOGOS = {
  eventosAp: "/images/eventos_ap_logo.jpg",
  marcas: [
    { nombre: "D'Onofrio", src: "/images/donofrio.jpg" },
    { nombre: "Juguetón", src: "/images/jugueton.png" },
  ],
};

export function LoginPage() {
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Si se llegó aquí porque la sesión venció, se explica en vez de mostrar el login sin más
  const [sesionExpirada] = useState(() => {
    try {
      const vencio = sessionStorage.getItem(SESION_EXPIRADA_KEY) === "1";
      sessionStorage.removeItem(SESION_EXPIRADA_KEY);
      return vencio;
    } catch {
      return false;
    }
  });
  const [googleBrand, setGoogleBrand] = useState<"donofrio" | "jugueton">("donofrio");
  const submitLockRef = useRef(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(mensajeDeError({ status: response.status, message: data?.error }, "No se pudo iniciar sesión."));
        return;
      }

      setAuthSession(data.token, data.user);
      if (isDriverRole(data.user?.rol)) {
        if (data.user?.brand) {
          localStorage.setItem("selectedBrand", data.user.brand);
        }
        navigate("/chofer");
      } else {
        navigate("/seleccionar-marca");
      }
    } catch {
      setError("No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: credential,
          brand: googleBrand,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(mensajeDeError({ status: response.status, message: data?.error }, "No se pudo iniciar sesión con Google."));
        return;
      }

      setAuthSession(data.token, data.user);
      if (isDriverRole(data.user?.rol)) {
        if (data.user?.brand) {
          localStorage.setItem("selectedBrand", data.user.brand);
        }
        navigate("/chofer");
      } else {
        navigate("/seleccionar-marca");
      }
    } catch {
      setError("No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado izquierdo: identidad de la plataforma y de las dos marcas */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-brand-navy to-[#2F5BD3] dark:from-[#14285e] dark:to-[#1d3f99] items-center justify-center">
        <div className="text-white text-center px-8">
          <div className="w-[320px] max-w-full rounded-2xl bg-white/15 p-4 mx-auto mb-6">
            <img src={LOGOS.eventosAp} alt="Eventos AP" className="w-full h-auto object-contain rounded-lg bg-white p-2" />
          </div>
          <h2 className="text-4xl mb-4">Eventos AP</h2>
          <p className="text-xl text-white/90">Plataforma de Entregas</p>
          <div className="mt-10 flex items-center justify-center gap-4">
            {LOGOS.marcas.map((m) => (
              <div key={m.nombre} className="w-24 h-24 rounded-2xl bg-white p-3 shadow-lg flex items-center justify-center">
                <img src={m.src} alt={m.nombre} className="max-w-full max-h-full object-contain" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-white dark:bg-gray-900">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-[240px] max-w-full rounded-xl bg-gray-100 flex items-center justify-center p-2 border border-gray-200 dark:border-gray-700">
                <img src={LOGOS.eventosAp} alt="Eventos AP" className="w-full h-auto object-contain rounded-md" />
              </div>
            </div>
            <h2 className="text-3xl text-gray-900 dark:text-white mb-2">Iniciar Sesión</h2>
            <p className="text-gray-600 dark:text-gray-400">Bienvenido a Eventos AP</p>
          </div>

          <div className="mb-6 space-y-3">
            <label htmlFor="googleBrand" className="block text-sm text-gray-700 dark:text-gray-300">
              Marca para primer acceso con Google
            </label>
            <select
              id="googleBrand"
              value={googleBrand}
              onChange={(e) => setGoogleBrand(e.target.value as "donofrio" | "jugueton")}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
            >
              <option value="donofrio">D'Onofrio</option>
              <option value="jugueton">Juguetón</option>
            </select>

            {hasGoogleClientId ? (
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      handleGoogleLogin(credentialResponse.credential);
                    } else {
                      setError("Google no devolvió credenciales");
                    }
                  }}
                  onError={() => setError("No se pudo iniciar sesión con Google")}
                />
              </div>
            ) : (
              <div className="w-full px-4 py-3 border border-amber-300 rounded-lg bg-amber-50 text-amber-700 text-sm dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
                Configura VITE_GOOGLE_CLIENT_ID para habilitar Google Sign-In.
              </div>
            )}
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">O ingresa con tu cuenta</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            ) : sesionExpirada ? (
              <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
                Tu sesión expiró. Vuelve a iniciar sesión para continuar.
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="block text-sm mb-2 text-gray-700 dark:text-gray-300">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm mb-2 text-gray-700 dark:text-gray-300">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-brand-orange border-gray-300 rounded focus:ring-brand-orange"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Recordarme</span>
              </label>
              <a href="#" className="text-sm text-brand-navy dark:text-blue-400 hover:text-[#E64441]">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-orange text-white py-3 rounded-lg hover:bg-[#E64441] transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Ingresando..." : "Iniciar Sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
