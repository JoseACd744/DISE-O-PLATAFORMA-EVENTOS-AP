import { BrandGuard } from "../components/BrandGuard";
import { FichasPage } from "./FichasPage";
import { InflablesPage } from "./InflablesPage";
import { RoutesMapPage } from "./RoutesMapPage";
import { AssetsPage } from "./AssetsPage";

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

/** Rutas — ambas marcas */
export function GuardedRoutesMapPage() {
  return (
    <BrandGuard allowedBrands={["donofrio", "jugueton"]}>
      <RoutesMapPage />
    </BrandGuard>
  );
}

/** Activos — ambas marcas */
export function GuardedAssetsPage() {
  return (
    <BrandGuard allowedBrands={["donofrio", "jugueton"]}>
      <AssetsPage />
    </BrandGuard>
  );
}
