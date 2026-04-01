import { BrandGuard } from "../components/BrandGuard";
import { FichasPage } from "./FichasPage";
import { InflablesPage } from "./InflablesPage";
import { RoutesMapPage } from "./RoutesMapPage";

/** Fichas — ambas marcas */
export function GuardedFichasPage() {
  return (
    <BrandGuard allowedBrands={["donofrio", "jugueton"]}>
      <FichasPage />
    </BrandGuard>
  );
}

/** Inflables — solo Juguetón */
export function GuardedInflablesPage() {
  return (
    <BrandGuard allowedBrands={["jugueton"]}>
      <InflablesPage />
    </BrandGuard>
  );
}

/** Rutas — solo D'Onofrio */
export function GuardedRoutesMapPage() {
  return (
    <BrandGuard allowedBrands={["donofrio"]}>
      <RoutesMapPage />
    </BrandGuard>
  );
}
