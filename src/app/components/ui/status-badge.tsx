import * as React from "react";
import { AlertCircle, CheckCircle2, CircleDashed, Clock, Loader, MinusCircle } from "lucide-react";
import { cn } from "./utils";
import { CLASES_TONO, type Tono } from "../../lib/estados";

// El ícono acompaña al color para que el estado no dependa solo de él
const ICONOS: Record<Tono, React.ComponentType<{ className?: string }>> = {
  green: CheckCircle2,
  amber: CircleDashed,
  red: AlertCircle,
  blue: Loader,
  gray: MinusCircle,
  purple: Clock,
};

export function StatusBadge({ label, tono, className, sinIcono = false }: {
  label: string;
  tono: Tono;
  className?: string;
  sinIcono?: boolean;
}) {
  const Icono = ICONOS[tono];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs whitespace-nowrap", CLASES_TONO[tono], className)}>
      {!sinIcono && <Icono className="w-3.5 h-3.5 shrink-0" />}
      {label}
    </span>
  );
}

/** Badge a partir de un mapa de estados (ESTADOS_PAGO, ESTADOS_ASIGNACION…); estados desconocidos salen en gris */
export function EstadoBadge({ estado, mapa, className }: {
  estado: string;
  mapa: Record<string, { label: string; tono: Tono }>;
  className?: string;
}) {
  const info = mapa[estado] ?? { label: estado ? estado.charAt(0).toUpperCase() + estado.slice(1).replace(/[-_]/g, " ") : "—", tono: "gray" as Tono };
  return <StatusBadge label={info.label} tono={info.tono} className={className} />;
}
