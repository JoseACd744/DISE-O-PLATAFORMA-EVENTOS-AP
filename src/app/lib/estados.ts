// Estados de la app con su etiqueta y tono, en un solo lugar para que se vean igual en todas las páginas

export type Tono = "green" | "amber" | "red" | "blue" | "gray" | "purple";

export type EstadoPago = "pagado" | "parcial" | "pendiente";

/** Estado de pago a partir del total y lo abonado */
export function estadoPago(total: number, abonado: number): EstadoPago {
  if (total - abonado <= 0.005) return "pagado";
  if (abonado > 0) return "parcial";
  return "pendiente";
}

export const ESTADOS_PAGO: Record<EstadoPago, { label: string; tono: Tono }> = {
  pagado: { label: "Pagado", tono: "green" },
  parcial: { label: "Parcial", tono: "amber" },
  pendiente: { label: "Pendiente", tono: "red" },
};

export const ESTADOS_ASIGNACION: Record<string, { label: string; tono: Tono }> = {
  programada: { label: "Programada", tono: "amber" },
  "en-curso": { label: "En curso", tono: "blue" },
  en_curso: { label: "En curso", tono: "blue" },
  completada: { label: "Completada", tono: "green" },
  cancelada: { label: "Cancelada", tono: "gray" },
};

export const ESTADOS_ALERTA: Record<string, { label: string; tono: Tono }> = {
  pendiente: { label: "Pendiente", tono: "red" },
  "en-proceso": { label: "En reparación", tono: "amber" },
  resuelta: { label: "Resuelta", tono: "green" },
};

export const ESTADOS_EQUIPO: Record<string, { label: string; tono: Tono }> = {
  disponible: { label: "Disponible", tono: "green" },
  "en-uso": { label: "En uso", tono: "blue" },
  "en-ruta": { label: "En ruta", tono: "blue" },
  ocupado: { label: "Ocupado", tono: "blue" },
  mantenimiento: { label: "Mantenimiento", tono: "amber" },
  descanso: { label: "Descanso", tono: "gray" },
};

export const CLASES_TONO: Record<Tono, string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};
