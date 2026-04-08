import { createBrowserRouter } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { BrandSelectPage } from "./pages/BrandSelectPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DriverLayout } from "./layouts/DriverLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DriverHomePage } from "./pages/DriverHomePage";
import { ClientsPage } from "./pages/ClientsPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { LogisticsPage } from "./pages/LogisticsPage";
import {
  GuardedFichasPage,
  GuardedInflablesPage,
  GuardedRoutesMapPage,
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
        index: true,
        Component: DashboardPage,
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
        path: "reportes",
        Component: ReportsPage,
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