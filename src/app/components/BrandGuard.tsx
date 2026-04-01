import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useBrand } from "../contexts/BrandContext";
import { ShieldX } from "lucide-react";

interface BrandGuardProps {
  allowedBrands: ("donofrio" | "jugueton")[];
  children: React.ReactNode;
}

/**
 * Protects a route so only users with the allowed brand can access it.
 * If the brand doesn't match, shows an "access denied" screen and redirects
 * after a short delay.
 */
export function BrandGuard({ allowedBrands, children }: BrandGuardProps) {
  const { brand } = useBrand();
  const navigate = useNavigate();

  const isAllowed = brand !== null && allowedBrands.includes(brand);

  useEffect(() => {
    if (!isAllowed && brand !== null) {
      const timeout = setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isAllowed, brand, navigate]);

  if (!isAllowed) {
    const brandLabel = brand === "donofrio" ? "D'Onofrio" : brand === "jugueton" ? "Juguetón" : "desconocida";
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl text-gray-900 dark:text-white mb-3">Acceso Restringido</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            La marca <span className="text-[#EF8022]">{brandLabel}</span> no tiene acceso a esta sección.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Serás redirigido al Dashboard en unos segundos...
          </p>
          <button
            onClick={() => navigate("/dashboard", { replace: true })}
            className="mt-6 px-6 py-2.5 bg-[#1F3C8B] text-white rounded-lg hover:bg-[#1F3C8B]/90 transition-colors text-sm"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
