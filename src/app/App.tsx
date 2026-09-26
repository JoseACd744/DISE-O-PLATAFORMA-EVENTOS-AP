import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./routes";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BrandProvider } from "./contexts/BrandContext";
import { ProductsProvider } from "./contexts/ProductsContext";
import { queryClient } from "./lib/queries";
import { Toaster } from "./components/ui/sonner";
import { AvisoTI } from "./components/AvisoTI";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrandProvider>
          <ProductsProvider>
            {/* El aviso de TI va arriba del todo; la app ocupa el alto restante */}
            <div className="flex flex-col h-dvh">
              <AvisoTI />
              <div className="flex-1 min-h-0 overflow-auto">
                <RouterProvider router={router} />
              </div>
            </div>
          </ProductsProvider>
        </BrandProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;