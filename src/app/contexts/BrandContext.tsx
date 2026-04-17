import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAuthUser, isAdminRole } from "../lib/auth";

export type Brand = "donofrio" | "jugueton" | null;

interface BrandContextType {
  brand: Brand;
  setBrand: (brand: Brand) => void;
  clearBrand: () => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrandState] = useState<Brand>(() => {
    const authUser = getAuthUser();
    if (authUser?.brand && !isAdminRole(authUser.rol)) {
      return authUser.brand;
    }

    const stored = localStorage.getItem("selectedBrand") as Brand;
    return stored || null;
  });

  useEffect(() => {
    const authUser = getAuthUser();
    if (authUser?.brand && !isAdminRole(authUser.rol) && brand !== authUser.brand) {
      setBrandState(authUser.brand);
      return;
    }

    if (brand) {
      localStorage.setItem("selectedBrand", brand);
    } else {
      localStorage.removeItem("selectedBrand");
    }
  }, [brand]);

  const setBrand = (b: Brand) => {
    const authUser = getAuthUser();
    if (authUser?.brand && !isAdminRole(authUser.rol)) {
      setBrandState(authUser.brand);
      return;
    }
    setBrandState(b);
  };

  const clearBrand = () => {
    const authUser = getAuthUser();
    if (authUser?.brand && !isAdminRole(authUser.rol)) {
      setBrandState(authUser.brand);
      return;
    }
    setBrandState(null);
  };

  return (
    <BrandContext.Provider value={{ brand, setBrand, clearBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand must be used within BrandProvider");
  }
  return context;
}
