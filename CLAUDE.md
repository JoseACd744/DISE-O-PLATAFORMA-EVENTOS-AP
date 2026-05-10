# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
```

No lint or test scripts are configured.

## Architecture

This is a React 18 + TypeScript SPA for managing events/logistics for two brands: **D'Onofrio** and **Juguetón**. Deployed to Firebase Hosting; backend is a REST API on Railway.

### Entry points

- `src/main.tsx` — mounts app, conditionally wraps with `GoogleOAuthProvider`
- `src/app/App.tsx` — stacks three context providers: `ThemeProvider → BrandProvider → ProductsProvider`
- `src/app/routes.tsx` — `createBrowserRouter` with nested routes under `DashboardLayout` and `DriverLayout`

### Routing & access control

Routes are organized into two layouts:

- **DashboardLayout** (`src/app/layouts/DashboardLayout.tsx`) — guards: must be authenticated, must not be a driver, must have a brand selected
- **DriverLayout** (`src/app/layouts/DriverLayout.tsx`) — for users with role `chofer`

Brand-specific routes (e.g., inflables, which is Juguetón-only) are wrapped with `BrandGuard` (`src/app/components/BrandGuard.tsx`).

### State management

No Redux or Zustand — all global state is React Context:

| Context | File | Purpose |
|---|---|---|
| `BrandContext` | `src/app/contexts/BrandContext.tsx` | Active brand (`donofrio`/`jugueton`), persisted to localStorage |
| `ThemeContext` | `src/app/contexts/ThemeContext.tsx` | Light/dark mode toggle |
| `ProductsContext` | `src/app/contexts/ProductsContext.tsx` | Products, packages, carritos, inflables, personal, recursos, fichas — all CRUD state |

`ProductsContext` is the largest context and serves as the primary data store for most pages.

### API layer

All HTTP calls go through `src/app/lib/api.ts` → `apiRequest<T>()`:
- Reads `VITE_API_BASE_URL` (default: `https://eventos-ap-backend-production.up.railway.app/api`)
- Injects `Authorization: Bearer <token>` automatically
- On 401 → clears auth and redirects to `/login`
- Response mapping between API shapes and domain types lives in `src/app/lib/mappers.ts`

Auth utilities (get/set token, current user, role checks) are in `src/app/lib/auth.ts`.

### Key pages

| Page | Route | Notes |
|---|---|---|
| `LoginPage` | `/login` | Google OAuth + email/password |
| `BrandSelectPage` | `/seleccionar-marca` | Admin selects D'Onofrio or Juguetón |
| `FichasPage` | `/dashboard/fichas` | Most complex — event invoice management with products, resources, pricing |
| `LogisticsPage` | `/dashboard/logistica` | Delivery coordination |
| `RoutesMapPage` | `/dashboard/rutas` | Google Maps integration |
| `InflablesPage` | `/dashboard/inflables` | Juguetón-only, guarded by `BrandGuard` |
| `DriverHomePage` | `/chofer` | Separate driver portal |

### UI components

Pre-built shadcn/ui + Radix UI components live in `src/app/components/ui/`. Add new generic UI there. Page-specific components stay in-file or alongside the page.

### Environment variables

```
VITE_API_BASE_URL       # Backend base URL
VITE_GOOGLE_CLIENT_ID   # Google OAuth client ID
```

### Tech stack

React Router 7, Tailwind CSS 4, React Hook Form, Recharts, react-google-maps/api, react-dnd, Sonner (toasts), Lucide icons.
