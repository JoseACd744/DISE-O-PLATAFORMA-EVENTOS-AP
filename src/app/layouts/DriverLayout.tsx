import { Outlet, useNavigate } from "react-router";
import { useEffect } from "react";
import { LogOut, Truck } from "lucide-react";
import { useBrand } from "../contexts/BrandContext";
import { clearAuthSession, getAuthUser, isAuthenticated, isDriverRole } from "../lib/auth";

export function DriverLayout() {
  const navigate = useNavigate();
  const { setBrand } = useBrand();

  const authUser = getAuthUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    if (!isDriverRole(authUser?.rol)) {
      navigate("/dashboard");
      return;
    }

    if (authUser?.brand) {
      setBrand(authUser.brand);
      localStorage.setItem("selectedBrand", authUser.brand);
    }
  }, [authUser?.brand, authUser?.rol, navigate, setBrand]);

  const handleLogout = () => {
    clearAuthSession();
    localStorage.removeItem("selectedBrand");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#EF8022]/10 p-2 text-[#EF8022]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-900 dark:text-white">Modulo Chofer</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{authUser?.nombre || "Chofer"}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
