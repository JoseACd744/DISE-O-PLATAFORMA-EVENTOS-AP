import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle, X } from "lucide-react";
import { cn } from "./utils";

const ANCHOS = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-6xl",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Acciones del pie (botones). Quedan fijas abajo aunque el contenido tenga scroll. */
  footer?: React.ReactNode;
  /** Error a mostrar junto a los botones, siempre visible aunque el formulario sea largo */
  error?: React.ReactNode;
  size?: keyof typeof ANCHOS;
  /** Mientras se guarda no se puede cerrar (Esc, clic afuera ni la X) */
  busy?: boolean;
  /** z-index por encima de otro modal abierto (p. ej. un sub-modal) */
  elevated?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Modal estándar de la app: cabecera con título y cerrar, cuerpo con scroll que nunca pasa del alto
 * de la pantalla, pie fijo con acciones y error visible. Se cierra con Esc y mantiene el foco dentro.
 */
export function Modal({
  open, onClose, title, description, footer, error, size = "md", busy = false, elevated = false,
  className, bodyClassName, children,
}: ModalProps) {
  const cerrar = (abierto: boolean) => {
    if (!abierto && !busy) onClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={cerrar}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            elevated ? "z-[70]" : "z-50"
          )}
        />
        <DialogPrimitive.Content
          onInteractOutside={(e) => { if (busy) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col w-[calc(100%-1.5rem)] max-h-[calc(100dvh-1.5rem)]",
            "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            elevated ? "z-[70]" : "z-50",
            ANCHOS[size],
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-xl text-gray-900 dark:text-white">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Diálogo"}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              disabled={busy}
              className="shrink-0 -mr-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </DialogPrimitive.Close>
          </div>

          <div className={cn("flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4", bodyClassName)}>{children}</div>

          {(footer || error) && (
            <div className="px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
              {error ? <ModalError>{error}</ModalError> : null}
              {footer ? <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">{footer}</div> : null}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ModalError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
