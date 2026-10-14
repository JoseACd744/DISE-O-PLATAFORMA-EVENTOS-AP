import { compararLineas, type LineaRegistrada, type TrazabilidadCotizacion } from "../lib/cotizacionTrazabilidad";

const dinero = (n: number) => `S/ ${n.toFixed(2)}`;
const fecha = (s: string) => new Date(s).toLocaleString("es-PE", { timeZone: "America/Lima" });
export function DetalleAjusteCotizacion({ total, base, registro, lineas, motivo, onMotivoChange, editado }: {
  total: number; base: number; registro?: TrazabilidadCotizacion | null; lineas: LineaRegistrada[];
  motivo: string; onMotivoChange: (value: string) => void; editado: boolean;
}) {
  const actual = registro?.actual;
  const diferencia = Math.round((total - base) * 100) / 100;
  const cambios = actual?.lineas.length ? compararLineas(actual.lineas, lineas) : [];
  const tieneDiferencia = Math.abs(diferencia) >= 0.01;
  if (!tieneDiferencia && !registro) return null;
  return <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-gray-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-gray-200">
    <p className="font-semibold">Origen de la diferencia</p>
    <p className="mt-1">Cotización {dinero(total)} − desglose {dinero(base)} = {diferencia < 0 ? "− " : "+ "}{dinero(Math.abs(diferencia))}.</p>
    <p className="mt-1">El descuento global se aplica después de esta diferencia.</p>
    {editado ? <p className="mt-2">Se modificó «Cotización Total» en esta edición. El cambio se registrará al guardar.</p>
      : actual?.origen === "manual" ? <p className="mt-2">Ajuste registrado en «Cotización Total»: {actual.motivo}. {actual.usuario || "Usuario no disponible"}{actual.fecha ? ` · ${fecha(actual.fecha)}` : ""}. Importe registrado: {dinero(actual.ajuste)}.</p>
        : tieneDiferencia && <p className="mt-2">Este total no tiene un ajuste manual documentado. Al cambiar los ítems se recalculará el total. Pulsa «Usar sugerido» para corregirlo ahora, o indica un motivo real si la diferencia corresponde a un cargo adicional.</p>}
    {cambios.length > 0 && <div className="mt-2"><p className="font-semibold">Cambios respecto al último desglose guardado</p><ul className="mt-1 space-y-1">
      {cambios.map(c => <li key={c.key}>{c.ahora?.descripcion || c.antes?.descripcion}: {c.antes ? `${c.antes.cantidad} × ${dinero(c.antes.precioUnitario)}, descuento ${dinero(c.antes.descuentoMonto)}, total ${dinero(c.antes.total)}` : "No estaba incluido"} → {c.ahora ? `${c.ahora.cantidad} × ${dinero(c.ahora.precioUnitario)}, descuento ${dinero(c.ahora.descuentoMonto)}, total ${dinero(c.ahora.total)}` : "Retirado"}.</li>)}
    </ul><p className="mt-1">Estos cambios pueden venir de la edición actual o de precios actualizados en el catálogo.</p></div>}
    {tieneDiferencia && <label className="mt-3 block">Motivo / concepto del ajuste{editado ? " *" : " (si se conoce)"}
      <input value={motivo} onChange={e => onMotivoChange(e.target.value)} maxLength={500} required={editado} placeholder="Ej.: servicio adicional de montaje, S/ 60" className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
    </label>}
    {registro && <details className="mt-3"><summary className="cursor-pointer font-semibold">Historial de cotización ({registro.historial.length})</summary>
      <ul className="mt-2 space-y-2">{[...registro.historial].reverse().map((r, i) => <li key={i}>{r.fecha ? fecha(r.fecha) : "Fecha no disponible"} · {r.usuario || "Usuario no disponible"}: {r.cotizacionAnterior == null ? "Creación" : dinero(r.cotizacionAnterior)} → {dinero(r.cotizacion)}; desglose {dinero(r.base)}; diferencia {dinero(r.ajuste)}. {r.origen === "manual" ? `Cotización Total: ${r.motivo}` : r.origen === "calculado" ? "Cálculo del desglose." : "Total anterior sin motivo documentado."}</li>)}</ul>
    </details>}
  </div>;
}
