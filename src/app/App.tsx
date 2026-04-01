import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BrandProvider } from "./contexts/BrandContext";
import { ProductsProvider } from "./contexts/ProductsContext";

function App() {
  return (
    <ThemeProvider>
      <BrandProvider>
        <ProductsProvider>
          <RouterProvider router={router} />
        </ProductsProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}

export default App;