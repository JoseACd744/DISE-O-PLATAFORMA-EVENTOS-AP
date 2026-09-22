// `new Date().toISOString()` devuelve la fecha en UTC: en Perú (UTC-5), a partir de las
// 7 de la noche ya entrega el día siguiente. Estos helpers trabajan siempre con la fecha
// local para que "hoy" sea el día que ve el usuario.

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Convierte una fecha "YYYY-MM-DD" (o ISO completa) a Date en hora local, sin el
// desfase que produce `new Date("2026-09-22")`, que se interpreta como UTC.
export function parseLocalDate(value: string): Date {
  return new Date(`${(value || "").slice(0, 10)}T00:00:00`);
}
