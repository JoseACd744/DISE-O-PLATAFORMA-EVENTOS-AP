import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./routes";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BrandProvider } from "./contexts/BrandContext";
import { ProductsProvider } from "./contexts/ProductsContext";
import { queryClient } from "./lib/queries";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrandProvider>
          <ProductsProvider>
            <RouterProvider router={router} />
          </ProductsProvider>
        </BrandProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;