import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { isDriverRole, setAuthSession } from "../lib/auth";

const LOGOS = {
  eventosAp: "/images/eventos_ap.png",
};

export function LoginPage() {
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [googleBrand, setGoogleBrand] = useState<"donofrio" | "jugueton">("donofrio");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "No se pudo iniciar sesión");
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
      setError("No se pudo conectar con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
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

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "No se pudo iniciar sesión con Google");
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
      setError("No se pudo conectar con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src="https://images.unsplash.com/photo-1760662052295-f84068499a03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWxpdmVyeSUyMHRydWNrJTIwbG9naXN0aWNzfGVufDF8fHx8MTc3MTMzMTI1Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Delivery truck"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1F3C8B]/95 to-[#3B82F6]/80 flex items-center justify-center">
          <div className="text-white text-center px-8">
            <div className="w-[320px] max-w-full rounded-2xl bg-white/20 backdrop-blur-sm p-4 mx-auto mb-6">
              <img src={LOGOS.eventosAp} alt="Eventos AP" className="w-full h-auto object-contain rounded-lg bg-white p-2" />
            </div>
            <h2 className="text-4xl mb-4">Eventos AP</h2>
            <p className="text-xl">Plataforma de Entregas</p>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-[240px] max-w-full rounded-xl bg-gray-100 flex items-center justify-center p-2 border border-gray-200">
                <img src={LOGOS.eventosAp} alt="Eventos AP" className="w-full h-auto object-contain rounded-md" />
              </div>
            </div>
            <h2 className="text-3xl text-gray-900 mb-2">Iniciar Sesión</h2>
            <p className="text-gray-600">Bienvenido a Eventos AP</p>
          </div>

          <div className="mb-6 space-y-3">
            <label htmlFor="googleBrand" className="block text-sm text-gray-700">
              Marca para primer acceso con Google
            </label>
            <select
              id="googleBrand"
              value={googleBrand}
              onChange={(e) => setGoogleBrand(e.target.value as "donofrio" | "jugueton")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
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
              <div className="w-full px-4 py-3 border border-amber-300 rounded-lg bg-amber-50 text-amber-700 text-sm">
                Configura VITE_GOOGLE_CLIENT_ID para habilitar Google Sign-In.
              </div>
            )}
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">O ingresa con tu cuenta</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="block text-sm mb-2 text-gray-700">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm mb-2 text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[#EF8022] border-gray-300 rounded focus:ring-[#EF8022]"
                />
                <span className="ml-2 text-sm text-gray-600">Recordarme</span>
              </label>
              <a href="#" className="text-sm text-[#1F3C8B] hover:text-[#E64441]">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#EF8022] text-white py-3 rounded-lg hover:bg-[#E64441] transition-colors font-semibold"
            >
              {isSubmitting ? "Ingresando..." : "Iniciar Sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
