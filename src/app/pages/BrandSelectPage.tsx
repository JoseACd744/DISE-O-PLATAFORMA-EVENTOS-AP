import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useBrand, Brand } from "../contexts/BrandContext";
import { IceCreamCone, PartyPopper, ArrowRight, LogOut } from "lucide-react";
import { clearAuthSession, getAuthUser, isAdminRole, isAuthenticated, isDriverRole } from "../lib/auth";

const brands = [
  {
    id: "donofrio" as Brand,
    name: "D'Onofrio",
    logo: "/images/donofrio.jpg",
    logoClass: "max-w-full max-h-full object-contain",
    description: "Gestiona entregas de helados, cartera de clientes, fichas de eventos y optimiza rutas de reparto.",
    icon: IceCreamCone,
    color: "#1F3C8B",
    colorLight: "rgba(31, 60, 139, 0.1)",
    features: ["Clientes", "Productos", "Fichas de Eventos", "Rutas", "Reportes"],
  },
  {
    id: "jugueton" as Brand,
    name: "Juguetón",
    logo: "/images/jugueton.png",
    logoClass: "max-w-full max-h-full object-contain",
    description: "Administra el inventario de inflables, reservas por calendario, y consulta productos de helados para paquetes.",
    icon: PartyPopper,
    color: "#EF8022",
    colorLight: "rgba(239, 128, 34, 0.1)",
    features: ["Inflables", "Calendario de Reservas", "Productos (consulta)", "Reportes"],
  },
];

export function BrandSelectPage() {
  const navigate = useNavigate();
  const { setBrand } = useBrand();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    const user = getAuthUser();
    if (isDriverRole(user?.rol)) {
      if (user?.brand) {
        setBrand(user.brand);
      }
      navigate("/chofer");
      return;
    }

    if (user && !isAdminRole(user.rol)) {
      if (user.brand) {
        setBrand(user.brand);
      }
      navigate("/dashboard");
    }
  }, [navigate, setBrand]);

  const handleSelectBrand = (brand: Brand) => {
    setBrand(brand);
    navigate("/dashboard");
  };

  const handleLogout = () => {
    clearAuthSession();
    localStorage.removeItem("selectedBrand");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="w-20 h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-1 flex items-center justify-center">
            <img src="/images/eventos_ap_logo.jpg" alt="Eventos AP" className="w-full h-full object-contain" />
          </div>
          <span className="text-gray-800 dark:text-gray-200" style={{ fontSize: "18px" }}>Eventos AP</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Salir</span>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-8 sm:pb-12">
        <div className="text-center mb-12">
          <h1 className="text-gray-900 dark:text-white mb-3" style={{ fontSize: "28px" }}>
            Selecciona tu marca
          </h1>
          <p className="text-gray-500 dark:text-gray-400" style={{ fontSize: "16px" }}>
            Elige la unidad de negocio con la que deseas trabajar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {brands.map((brand) => {
            const Icon = brand.icon;
            return (
              <button
                key={brand.id}
                onClick={() => handleSelectBrand(brand.id)}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-transparent transition-all duration-300 text-left shadow-sm hover:shadow-xl"
                style={{
                  // @ts-ignore
                  "--hover-border": brand.color,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = brand.color;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "";
                }}
              >
                {/* Cabecera con el logo de la marca */}
                <div
                  className="h-44 relative overflow-hidden flex items-center gap-4 px-5"
                  style={{ background: `linear-gradient(135deg, ${brand.color} 0%, ${brand.color}cc 100%)` }}
                >
                  <Icon className="absolute -right-6 -bottom-6 w-40 h-40 text-white/10 group-hover:scale-110 transition-transform duration-500" aria-hidden="true" />
                  <div className="relative w-24 h-24 shrink-0 rounded-2xl bg-white p-3 shadow-lg flex items-center justify-center">
                    <img src={brand.logo} alt={`Logo ${brand.name}`} className={brand.logoClass} />
                  </div>
                  <h2 className="relative text-white min-w-0 truncate" style={{ fontSize: "24px" }}>{brand.name}</h2>
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-gray-600 dark:text-gray-400 mb-4" style={{ fontSize: "14px" }}>
                    {brand.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-5">
                    {brand.features.map((feature) => (
                      <span
                        key={feature}
                        className="px-3 py-1 rounded-full dark:text-gray-300"
                        style={{
                          fontSize: "12px",
                          backgroundColor: brand.colorLight,
                          color: brand.color,
                        }}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div
                    className="flex items-center gap-2 group-hover:gap-3 transition-all"
                    style={{ color: brand.color, fontSize: "14px" }}
                  >
                    <span>Ingresar</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
