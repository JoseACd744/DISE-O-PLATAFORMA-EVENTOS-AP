import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "./utils";

const TONOS = {
  default: "text-gray-900 dark:text-white",
  navy: "text-brand-navy dark:text-blue-400",
  orange: "text-brand-orange",
  green: "text-green-600 dark:text-green-400",
  red: "text-red-600 dark:text-red-400",
  purple: "text-purple-600 dark:text-purple-400",
  amber: "text-amber-600 dark:text-amber-400",
} as const;

export type Variacion = { texto: string; sube: boolean | null } | null;

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Texto del valor para el tooltip cuando no entra completo (por defecto el propio valor si es texto) */
  valueTitle?: string;
  icon?: React.ReactNode;
  tone?: keyof typeof TONOS;
  detail?: React.ReactNode;
  delta?: Variacion;
  comparacion?: string;
  /** true si que el número suba es bueno (ventas); false si es malo (deudas) */
  subirEsBueno?: boolean;
  /** Tarjeta destacada con fondo de marca */
  highlight?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Tarjeta de indicador. El valor nunca se sale de la tarjeta: se achica en pantallas angostas,
 * no se parte en dos líneas y, si aun así no entra, se recorta con "…" y muestra el valor completo al pasar el mouse.
 */
export function StatCard({
  label, value, valueTitle, icon, tone = "default", detail, delta, comparacion, subirEsBueno = true, highlight = false, loading = false, className,
}: StatCardProps) {
  const bueno = delta?.sube == null ? null : delta.sube === subirEsBueno;
  const IconoDelta = delta?.sube == null ? Minus : delta.sube ? ArrowUpRight : ArrowDownRight;
  const titulo = valueTitle ?? (typeof value === "string" || typeof value === "number" ? String(value) : undefined);

  return (
    <div
      className={cn(
        "min-w-0 p-4 md:p-5 rounded-xl border",
        highlight
          ? "bg-brand-navy border-brand-navy text-white dark:bg-blue-900/40 dark:border-blue-800"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-1.5 min-w-0">
        {icon ? <span className={cn("shrink-0 [&_svg]:w-4 [&_svg]:h-4", highlight ? "text-white/80" : "")}>{icon}</span> : null}
        <p className={cn("text-xs sm:text-sm truncate", highlight ? "text-white/80" : "text-gray-600 dark:text-gray-400")} title={label}>{label}</p>
      </div>
      <p
        className={cn(
          "text-lg sm:text-xl xl:text-2xl leading-tight tabular-nums whitespace-nowrap truncate",
          highlight ? "text-white" : TONOS[tone]
        )}
        title={titulo}
      >
        {loading ? <span className="inline-block h-6 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse align-middle" /> : value}
      </p>
      {delta && !loading && (
        <p className={cn(
          "mt-1 text-xs flex items-center gap-1 min-w-0",
          bueno === null ? "text-gray-500 dark:text-gray-400" : bueno ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          <IconoDelta className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{delta.texto} <span className="text-gray-500 dark:text-gray-400">vs {comparacion}</span></span>
        </p>
      )}
      {detail && !loading ? (
        <p className={cn("mt-1 text-xs line-clamp-2", highlight ? "text-white/70" : "text-gray-500 dark:text-gray-400")}>{detail}</p>
      ) : null}
    </div>
  );
}

/** Variación porcentual entre dos valores (para `delta`) */
export function variacion(actual: number, previo: number): Variacion {
  if (previo === 0) return actual > 0 ? { texto: "nuevo", sube: true } : null;
  const pct = ((actual - previo) / previo) * 100;
  if (Math.abs(pct) < 0.05) return { texto: "0%", sube: null };
  return { texto: `${pct > 0 ? "+" : ""}${pct.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`, sube: pct > 0 };
}
