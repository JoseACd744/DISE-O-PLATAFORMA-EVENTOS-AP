const DESCUENTO_MAX_PCT_KEY = "descuentoMaxPct";

export const DEFAULT_DESCUENTO_MAX_PCT = 10;

export function getDescuentoMaxPct(): number {
  const raw = localStorage.getItem(DESCUENTO_MAX_PCT_KEY);
  if (raw === null) return DEFAULT_DESCUENTO_MAX_PCT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DESCUENTO_MAX_PCT;
}

export function setDescuentoMaxPct(value: number) {
  const clamped = Math.min(100, Math.max(0, value));
  localStorage.setItem(DESCUENTO_MAX_PCT_KEY, String(clamped));
}
