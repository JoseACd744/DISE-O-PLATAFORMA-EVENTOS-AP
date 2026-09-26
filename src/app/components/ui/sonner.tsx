"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";
import { useTheme } from "../../contexts/ThemeContext";

// Usa el tema de la app (ThemeContext), no el del sistema
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      {...props}
    />
  );
};

export { Toaster };
