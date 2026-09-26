import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { BrandSelectPage } from "./pages/BrandSelectPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DriverLayout } from "./layouts/DriverLayout";
import { DriverHomePage } from "./pages/DriverHomePage";
import { ErrorScreen } from "./components/ErrorScreen";
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
    errorElement: <ErrorScreen />,
  },
  {
    path: "/login",
    Component: LoginPage,
    errorElement: <ErrorScreen />,
  },
  {
    path: "/seleccionar-marca",
    Component: BrandSelectPage,
    errorElement: <ErrorScreen />,
  },
  {
    path: "/dashboard",
    Component: DashboardLayout,
    errorElement: <ErrorScreen />,
    children: [{ errorElement: <ErrorScreen />, children: [
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
    ] }],
  },
  {
    path: "/chofer",
    Component: DriverLayout,
    errorElement: <ErrorScreen />,
    children: [{ errorElement: <ErrorScreen />, children: [
      {
        index: true,
        Component: DriverHomePage,
      },
    ] }],
  },
  {
    // Cualquier otra dirección: pantalla "Esta página no existe" en vez del error de React Router
    path: "*",
    loader: () => { throw new Response("", { status: 404 }); },
    errorElement: <ErrorScreen />,
  },
]);