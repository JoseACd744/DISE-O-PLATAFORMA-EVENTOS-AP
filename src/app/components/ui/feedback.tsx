import * as React from "react";
import { AlertCircle, Inbox, Loader2, RotateCcw } from "lucide-react";
import { cn } from "./utils";

/** Mensaje para cuando no hay datos (solo cuando ya terminó de cargar sin errores) */
export function EmptyState({ icon, title, description, action, className }: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-10 px-4", className)}>
      <div className="mb-3 text-gray-300 dark:text-gray-600 [&_svg]:w-10 [&_svg]:h-10">{icon ?? <Inbox />}</div>
      <p className="text-gray-700 dark:text-gray-300">{title}</p>
      {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Aviso de error dentro de la página, con opción de reintentar */
export function ErrorBanner({ children, onRetry, tone = "error", className }: {
  children: React.ReactNode;
  onRetry?: () => void;
  tone?: "error" | "warning";
  className?: string;
}) {
  const estilos = tone === "error"
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300";
  return (
    <div role="alert" className={cn("flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2.5 text-sm", estilos, className)}>
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reintentar
        </button>
      ) : null}
    </div>
  );
}

/** Indicador de carga para listas y paneles (en vez de mostrar "No hay datos" mientras carga) */
export function LoadingState({ label = "Cargando…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400", className)}>
      <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
      {label}
    </div>
  );
}
