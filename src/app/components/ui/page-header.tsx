import * as React from "react";
import { cn } from "./utils";

/** Título de página con subtítulo y acciones (a la derecha en escritorio, debajo en móvil) */
export function PageHeader({ title, subtitle, actions, className }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-1">{title}</h1>
        {subtitle ? <p className="text-gray-600 dark:text-gray-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0">{actions}</div> : null}
    </div>
  );
}
