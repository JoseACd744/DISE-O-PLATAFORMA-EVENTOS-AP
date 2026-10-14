import { getDescuentoLinea, toMoneyNumber, type LineaCotizacion } from "./cotizacion";

export type LineaRegistrada = Pick<LineaCotizacion, "key" | "descripcion" | "cantidad" | "precioUnitario" | "descuentoMonto" | "total">;
export interface RegistroCotizacion {
  origen: "manual" | "calculado" | "sin_registro";
  motivo: string;
  cotizacion: number;
  base: number;
  ajuste: number;
  descuentoGlobal: number;
  lineas: LineaRegistrada[];
  fecha?: string;
  usuario?: string;
  usuarioId?: string | null;
  cotizacionAnterior?: number | null;
}
export interface TrazabilidadCotizacion {
  actual: RegistroCotizacion;
  historial: RegistroCotizacion[];
}
export const redondearDinero = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function registrarLineas(lineas: LineaCotizacion[]): LineaRegistrada[] {
  return lineas.map(({ key, descripcion, cantidad, precioUnitario, descuentoMonto, total }) => ({ key, descripcion, cantidad, precioUnitario, descuentoMonto: redondearDinero(descuentoMonto), total: redondearDinero(total) }));
}
export function actualizarTotalPorLineas(total: number, anteriores: LineaCotizacion[], siguientes: LineaCotizacion[], conservarAjuste = true): number {
  const sum = (ls: LineaCotizacion[]) => ls.reduce((s, l) => s + l.total, 0);
  return Math.max(0, redondearDinero(conservarAjuste ? toMoneyNumber(total) + sum(siguientes) - sum(anteriores) : sum(siguientes)));
}
// Conserva el precio acordado sin congelar cantidades, descuentos ni la movilidad editable.
export function aplicarPreciosCotizados(lineas: LineaCotizacion[], guardadas: LineaRegistrada[]): LineaCotizacion[] {
  return lineas.map(linea => {
    if (linea.grupo === "Movilidad" || linea.grupo === "Personal" || linea.incluidoEnPaquete) return linea;
    const exacta = guardadas.find(l => l.key === linea.key && l.descripcion === linea.descripcion);
    const candidatas = guardadas.filter(l => l.descripcion === linea.descripcion && l.key.split("-")[0] === linea.key.split("-")[0]);
    const previa = exacta ?? (new Set(candidatas.map(l => l.precioUnitario)).size === 1 ? candidatas[0] : undefined);
    if (!previa || (linea.grupo === "Inflable" && previa.precioUnitario === 0 && linea.precioUnitario > 0)) return linea;
    const precioUnitario = previa.precioUnitario;
    const subtotal = redondearDinero(precioUnitario * linea.cantidad);
    const descuentoMonto = redondearDinero(linea.editable ? getDescuentoLinea(subtotal, linea) : 0);
    return { ...linea, precioUnitario, subtotal, descuentoMonto, total: Math.max(0, redondearDinero(subtotal - descuentoMonto)) };
  });
}
export function compararLineas(anteriores: LineaRegistrada[], actuales: LineaRegistrada[]) {
  const keys = new Set([...anteriores, ...actuales].map(l => l.key));
  return [...keys].flatMap(key => {
    const antes = anteriores.find(l => l.key === key);
    const ahora = actuales.find(l => l.key === key);
    const campos: (keyof LineaRegistrada)[] = ["key", "descripcion", "cantidad", "precioUnitario", "descuentoMonto", "total"];
    if (antes && ahora && campos.every(campo => antes[campo] === ahora[campo])) return [];
    return [{ key, antes, ahora }];
  });
}
