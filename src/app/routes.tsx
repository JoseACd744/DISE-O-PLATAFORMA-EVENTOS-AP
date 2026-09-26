import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { BrandSelectPage } from "./pages/BrandSelectPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DriverLayout } from "./layouts/DriverLayout";
import { DriverHomePage } from "./pages/DriverHomePage";
import { ClientsPage } from "./pages/ClientsPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { PagosPage } from "./pages/PagosPage";
import { LogisticsPage } from "./pages/LogisticsPage";
import {
  GuardedFichasPage,
  GuardedInflablesPage,
  GuardedRoutesMapPage,
  GuardedAssetsPage,
} from "./pages/GuardedPages";

export const router = createBrowserRouter([
  {
    index: true,
    Component: LoginPage,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/seleccionar-marca",
    Component: BrandSelectPage,
  },
  {
    path: "/dashboard",
    Component: DashboardLayout,
    children: [
      {
        // El antiguo Dashboard se fusionó con Reportes: al entrar se va directo a Fichas
        index: true,
        element: <Navigate to="/dashboard/fichas" replace />,
      },
      {
        path: "clientes",
        Component: ClientsPage,
      },
      {
        path: "productos",
        Component: ProductsPage,
      },
      {
        path: "fichas",
        Component: GuardedFichasPage,
      },
      {
        path: "logistica",
        Component: LogisticsPage,
      },
      {
        path: "rutas",
        Component: GuardedRoutesMapPage,
      },
      {
        path: "inflables",
        Component: GuardedInflablesPage,
      },
      {
        path: "activos",
        Component: GuardedAssetsPage,
      },
      {
        path: "reportes",
        Component: ReportsPage,
      },
      {
        path: "pagos",
        Component: PagosPage,
      },
    ],
  },
  {
    path: "/chofer",
    Component: DriverLayout,
    children: [
      {
        index: true,
        Component: DriverHomePage,
      },
    ],
  },
]);