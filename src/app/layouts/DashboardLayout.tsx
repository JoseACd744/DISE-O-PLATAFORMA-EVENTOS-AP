import { Outlet, useNavigate, useLocation } from "react-router";
import { Package, LayoutDashboard, Users, Map, LogOut, FileText, Moon, Sun, BarChart3, Wind, ArrowLeftRight, Truck, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useBrand } from "../contexts/BrandContext";
import { clearAuthSession, getAuthUser, isAuthenticated, isDriverRole } from "../lib/auth";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { brand, clearBrand } = useBrand();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    const authUser = getAuthUser();
    if (isDriverRole(authUser?.rol)) {
      navigate("/chofer");
      return;
    }

    if (!brand) {
      navigate("/seleccionar-marca");
    }
  }, [navigate, brand]);

  const handleLogout = () => {
    clearAuthSession();
    clearBrand();
    navigate("/login");
  };

  const handleSwitchBrand = () => {
    clearBrand();
    navigate("/seleccionar-marca");
  };

  // Menu items based on brand
  const allMenuItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, brands: ["donofrio", "jugueton"] },
    { path: "/dashboard/clientes", label: "Clientes", icon: Users, brands: ["donofrio", "jugueton"] },
    { path: "/dashboard/productos", label: "Productos", icon: Package, brands: ["donofrio", "jugueton"] },
    { path: "/dashboard/inflables", label: "Inflables", icon: Wind, brands: ["jugueton"] },
    { path: "/dashboard/fichas", label: "Fichas", icon: FileText, brands: ["donofrio", "jugueton"] },
    { path: "/dashboard/logistica", label: "Logística", icon: Truck, brands: ["donofrio", "jugueton"] },
    { path: "/dashboard/rutas", label: "Rutas", icon: Map, brands: ["donofrio", "jugueton"] },
    { path: "/dashboard/reportes", label: "Reportes", icon: BarChart3, brands: ["donofrio", "jugueton"] },
  ];

  const menuItems = allMenuItems.filter((item) => brand && item.brands.includes(brand));

  const brandConfig = {
    donofrio: {
      name: "D'Onofrio",
      color: "#1F3C8B",
      logoUrl: "/images/eventos_ap.png",
      logoClass: "w-full h-full object-contain",
      logoContainerClass: "w-14 h-9 rounded-lg p-1",
      logoContainerMobileClass: "w-11 h-7 rounded-md p-1",
    },
    jugueton: {
      name: "Juguetón",
      color: "#EF8022",
      logoUrl: "/images/jugueton.png",
      logoClass: "w-full h-full object-cover",
      logoContainerClass: "w-10 h-10 rounded-full p-0",
      logoContainerMobileClass: "w-7 h-7 rounded-full p-0",
    },
  };

  const currentBrand = brand ? brandConfig[brand] : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
      `}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`${currentBrand?.logoContainerClass || "w-14 h-9 rounded-lg p-1"} overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 bg-white flex items-center justify-center`}>
              <img
                src={currentBrand?.logoUrl || "/images/eventos_ap.png"}
                alt={currentBrand?.name || "Eventos AP"}
                className={currentBrand?.logoClass || "w-full h-full object-contain"}
              />
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 dark:text-white truncate" style={{ fontSize: "15px" }}>
                {currentBrand?.name || "Eventos AP"}
              </p>
              <p className="text-gray-500 dark:text-gray-400 truncate" style={{ fontSize: "11px" }}>
                Eventos AP
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <button
                    onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    style={isActive ? { backgroundColor: currentBrand?.color || "#1F3C8B" } : {}}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            onClick={handleSwitchBrand}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span>Cambiar Marca</span>
          </button>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-5 h-5" />
                <span>Modo Oscuro</span>
              </>
            ) : (
              <>
                <Sun className="w-5 h-5" />
                <span>Modo Claro</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-w-0 lg:ml-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`${currentBrand?.logoContainerMobileClass || "w-11 h-7 rounded-md p-1"} overflow-hidden border border-gray-200 dark:border-gray-700 bg-white flex items-center justify-center`}>
              <img
                src={currentBrand?.logoUrl || "/images/eventos_ap.png"}
                alt={currentBrand?.name || "Eventos AP"}
                className={currentBrand?.logoClass || "w-full h-full object-contain"}
              />
            </div>
            <span className="text-sm text-gray-900 dark:text-white">{currentBrand?.name || "Eventos AP"}</span>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}