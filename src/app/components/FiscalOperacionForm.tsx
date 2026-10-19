import { campo, etiqueta } from "../lib/ui";
import {
  dineroFiscal,
  nombreTipoFiscal,
  type BorradorOperacionFiscal,
  type DatosFiscales,
  type OperacionFiscal,
} from "../lib/fiscal";

export const operacionInicial: BorradorOperacionFiscal = {
  operacion: "total",
  abono_ids: [],
  documento_origen_id: "",
  motivo_codigo: "01",
  motivo: "",
  monto: 0,
};
export const esNotaFiscal = (op: OperacionFiscal) =>
  op === "nota_credito" || op === "nota_debito";
export function operacionesPermitidas(
  datos: DatosFiscales,
): Record<OperacionFiscal, boolean> {
  const activos = datos.comprobantes.filter(
    (d) =>
      !["rejected", "voided", "anulado", "rechazado"].includes(d.estado) &&
      !d.fiscal_closed,
  );
  const pendiente = activos.some(
    (d) =>
      !["accepted", "observed", "aceptado", "observado"].includes(d.estado),
  );
  const finales = activos.some(
    (d) =>
      ["01", "03"].includes(d.tipo) &&
      (d.operacion || d.snapshot?.operacion || "total") !== "anticipo",
  );
  const anticipos = activos.some(
    (d) =>
      (d.operacion || d.snapshot?.operacion) === "anticipo" &&
      ["accepted", "observed"].includes(d.estado),
  );
  const origen = activos.some(
    (d) =>
      ["01", "03"].includes(d.tipo) &&
      ["accepted", "observed"].includes(d.estado),
  );
  return {
    total: datos.defaults.operations?.total ?? !activos.length,
    anticipo:
      datos.defaults.operations?.anticipo ??
      (!finales &&
        !pendiente &&
        !!datos.defaults.abonos?.some((a) => a.disponible)),
    saldo:
      datos.defaults.operations?.saldo ?? (anticipos && !finales && !pendiente),
    nota_credito:
      datos.defaults.operations?.nota_credito ?? (origen && !pendiente),
    nota_debito:
      datos.defaults.operations?.nota_debito ?? (origen && !pendiente),
  };
}

export function FiscalOperacionForm({
  datos,
  value,
  onChange,
  disabled,
}: {
  datos: DatosFiscales;
  value: BorradorOperacionFiscal;
  onChange: (value: BorradorOperacionFiscal) => void;
  disabled: boolean;
}) {
  const permitidas = operacionesPermitidas(datos),
    nota = esNotaFiscal(value.operacion);
  const origenes = datos.comprobantes.filter(
    (d) =>
      ["01", "03"].includes(d.tipo) &&
      ["accepted", "observed"].includes(d.estado) &&
      !d.fiscal_closed,
  );
  const cambiarOperacion = (op: OperacionFiscal) =>
    onChange({
      ...operacionInicial,
      operacion: op,
      documento_origen_id: nota ? value.documento_origen_id : "",
      motivo_codigo: op === "nota_debito" ? "02" : "01",
    });
  return (
    <fieldset
      disabled={disabled}
      className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-600"
    >
      <label className={etiqueta}>
        Qué deseas emitir
        <select
          className={campo}
          value={value.operacion}
          onChange={(e) => cambiarOperacion(e.target.value as OperacionFiscal)}
        >
          <option value="total" disabled={!permitidas.total}>
            Operación completa
          </option>
          <option value="anticipo" disabled={!permitidas.anticipo}>
            Anticipo de abonos registrados
          </option>
          <option value="saldo" disabled={!permitidas.saldo}>
            Liquidación aplicando anticipos
          </option>
          <option value="nota_credito" disabled={!permitidas.nota_credito}>
            Nota de crédito
          </option>
          <option value="nota_debito" disabled={!permitidas.nota_debito}>
            Nota de débito
          </option>
        </select>
      </label>
      {!permitidas[value.operacion] && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Selecciona una operación disponible. Los documentos pendientes deben
          resolverse antes de continuar.
        </p>
      )}
      {value.operacion === "anticipo" && (
        <div className="space-y-2">
          <p className="text-sm">
            Selecciona los abonos que documentará este anticipo. Se usa
            únicamente su importe disponible, sin duplicar lo ya facturado.
          </p>
          {(datos.defaults.abonos || [])
            .filter((a) => a.disponible)
            .map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={value.abono_ids.includes(a.id)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      abono_ids: e.target.checked
                        ? [...value.abono_ids, a.id]
                        : value.abono_ids.filter((id) => id !== a.id),
                    })
                  }
                />
                <span>
                  {String(a.fecha).slice(0, 10)} ·{" "}
                  {dineroFiscal(a.monto_disponible ?? a.monto)}
                </span>
              </label>
            ))}
          <p className="text-right text-sm font-semibold">
            Anticipo seleccionado:{" "}
            {dineroFiscal(
              (datos.defaults.abonos || [])
                .filter((a) => value.abono_ids.includes(a.id))
                .reduce((s, a) => s + Number(a.monto_disponible ?? a.monto), 0),
            )}
          </p>
        </div>
      )}
      {value.operacion === "saldo" && (
        <p className="text-sm">
          Se conservarán los conceptos completos del pedido y se aplicarán los
          anticipos aceptados mediante sus referencias fiscales. Importe
          pendiente: {dineroFiscal(datos.defaults.ledger?.saldo)}.
        </p>
      )}
      {nota && (
        <>
          <label className={etiqueta}>
            Comprobante que se corrige
            <select
              className={campo}
              value={value.documento_origen_id}
              onChange={(e) =>
                onChange({ ...value, documento_origen_id: e.target.value })
              }
            >
              <option value="">Selecciona un comprobante aceptado</option>
              {origenes.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {nombreTipoFiscal(d.tipo)} {d.serie}-{d.numero} ·{" "}
                  {dineroFiscal(d.total)}
                </option>
              ))}
            </select>
          </label>
          <label className={etiqueta}>
            Motivo de la nota
            <select
              className={campo}
              value={value.motivo_codigo}
              onChange={(e) =>
                onChange({ ...value, motivo_codigo: e.target.value })
              }
            >
              {value.operacion === "nota_credito" ? (
                <>
                  <option value="01">Anulación de la operación</option>
                  <option value="04">Descuento global</option>
                  <option value="06">Devolución total</option>
                  <option value="09">Disminución en el valor</option>
                </>
              ) : (
                <>
                  <option value="01" disabled>
                    Intereses por mora · requiere perfil específico
                  </option>
                  <option value="02">Aumento en el valor</option>
                  <option value="03" disabled>
                    Penalidades · requiere perfil específico
                  </option>
                </>
              )}
            </select>
          </label>
          <label className={etiqueta}>
            Sustento de la corrección
            <textarea
              className={campo}
              rows={2}
              maxLength={500}
              value={value.motivo}
              onChange={(e) => onChange({ ...value, motivo: e.target.value })}
            />
          </label>
          {!(
            value.operacion === "nota_credito" &&
            ["01", "06"].includes(value.motivo_codigo)
          ) && (
            <label className={etiqueta}>
              Importe de la nota (incluye IGV)
              <input
                className={campo}
                type="number"
                min="0.01"
                step="0.01"
                value={value.monto || ""}
                onChange={(e) =>
                  onChange({ ...value, monto: Number(e.target.value) })
                }
              />
            </label>
          )}
          <p className="text-xs text-gray-500">
            El emisor y receptor se conservan del comprobante original. El
            efecto de la nota solo se aplica al recibir aceptación de SUNAT.
          </p>
        </>
      )}
    </fieldset>
  );
}
