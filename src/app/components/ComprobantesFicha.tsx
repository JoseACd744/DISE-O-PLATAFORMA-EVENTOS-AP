import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { campo, etiqueta } from "../lib/ui";
import { ApiError, apiRequest } from "../lib/api";
import { isAdminUser } from "../lib/auth";
import {
  consultarFiscal,
  descargarFiscal,
  dineroFiscal,
  emitirFiscal,
  estadoFiscal,
  nombreTipoFiscal,
  obtenerDatosFiscales,
  previsualizarFiscal,
  type ComprobanteFiscal,
  type DatosFiscales,
  type ReceptorFiscal,
  type SolicitudFiscal,
  type VistaFiscal,
} from "../lib/fiscal";

const vacio: ReceptorFiscal = {
  tipo_documento: "6",
  numero_documento: "",
  razon_social: "",
  direccion: "",
  email: "",
};
const errorTexto = (error: unknown) =>
  error instanceof ApiError && error.status === 404
    ? "El módulo de comprobantes aún no está disponible en este servidor. Debe desplegarse el backend de facturación."
    : error instanceof Error
      ? error.message
      : "No se pudo completar la operación.";
const pendiente = (estado: string) =>
  [
    "pendiente",
    "enviando",
    "enviado",
    "desconocido",
    "error",
    "queued",
    "sending",
    "unknown",
    "retry",
  ].includes(estado);

export function ComprobantesFicha({
  fichaId,
  brand,
  clienteNombre,
  onClose,
}: {
  fichaId: number;
  brand: "donofrio" | "jugueton";
  clienteNombre: string;
  onClose: () => void;
}) {
  const [datos, setDatos] = useState<DatosFiscales | null>(null);
  const [receptor, setReceptor] = useState<ReceptorFiscal>(vacio);
  const [tipo, setTipo] = useState<"01" | "03">("01");
  const [emisorId, setEmisorId] = useState("");
  const [formaPago, setFormaPago] = useState<"Contado" | "Credito">("Contado");
  const [afectacion, setAfectacion] = useState<"10" | "20" | "30">("10");
  const [cuotas, setCuotas] = useState<{ fecha: string; monto: number }[]>([]);
  const [vista, setVista] = useState<VistaFiscal | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [incierto, setIncierto] = useState(false);
  const [accesos, setAccesos] = useState<Record<string, string>>({});
  const key = useRef(crypto.randomUUID());
  const revision = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  const admin = isAdminUser();

  const cargar = useCallback(
    async (inicial = false) => {
      const result = await obtenerDatosFiscales(brand, fichaId);
      if (!mounted.current) return;
      setDatos(result);
      if (inicial) {
        setEmisorId(
          result.config.emitters?.find((e) => e.enabled)?.id ||
            result.config.emitters?.[0]?.id ||
            "",
        );
        setReceptor({ ...vacio, ...result.defaults.receptor });
        const tipoInicial =
          result.defaults.receptor?.tipo_documento === "6" ? "01" : "03";
        setTipo(tipoInicial);
        setFormaPago(
          tipoInicial === "03" ||
            Number(result.defaults.abonado) >= Number(result.defaults.total)
            ? "Contado"
            : "Credito",
        );
      }
    },
    [brand, fichaId],
  );
  useEffect(() => {
    mounted.current = true;
    cargar(true)
      .catch((e) => {
        if (mounted.current) setError(errorTexto(e));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [cargar]);
  useEffect(() => {
    if (vista)
      revision.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [vista]);

  const refrescar = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await cargar();
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const cambiar = (fn: () => void) => {
    if (incierto || busy) return;
    fn();
    setVista(null);
    setAcepta(false);
    setAviso("");
    setError("");
    key.current = crypto.randomUUID();
  };
  const solicitud = (): SolicitudFiscal => ({
    brand,
    ficha_id: fichaId,
    emisor_id: emisorId,
    tipo,
    receptor,
    forma_pago: formaPago,
    cuotas: formaPago === "Credito" ? cuotas : [],
    afectacion,
    version: datos!.defaults.version,
  });
  const revisar = async () => {
    if (lock.current || !datos) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setAviso("");
    try {
      const result = await previsualizarFiscal(solicitud());
      setVista(result);
      setAcepta(false);
      key.current = crypto.randomUUID();
    } catch (e) {
      setVista(null);
      setError(errorTexto(e));
      if (e instanceof ApiError && e.status === 409)
        await cargar().catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const emitir = async () => {
    if (lock.current || !vista || !acepta || !datos) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setAviso("");
    try {
      const doc = await emitirFiscal(
        solicitud(),
        vista.preview_token,
        key.current,
      );
      setIncierto(false);
      setVista(null);
      setAcepta(false);
      setAviso(
        `${nombreTipoFiscal(doc.tipo)} ${doc.serie}-${doc.numero}: ${estadoFiscal(doc.estado)}. Consulta el estado en el historial.`,
      );
      key.current = crypto.randomUUID();
      await cargar().catch(() =>
        setError(
          "El comprobante se registró, pero no se pudo actualizar el historial. Pulsa Actualizar para consultarlo.",
        ),
      );
    } catch (e) {
      const unknown = !(e instanceof ApiError) || e.status >= 500;
      setIncierto(unknown);
      setError(
        unknown
          ? "La respuesta de emisión no se pudo confirmar. Reintenta la misma solicitud para recuperar su resultado sin duplicarla."
          : errorTexto(e),
      );
      if (e instanceof ApiError && e.status === 409) {
        setVista(null);
        setAcepta(false);
        await cargar().catch(() => {});
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const operarDocumento = async (doc: ComprobanteFiscal, archivo?: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (archivo) await descargarFiscal(doc, archivo, brand);
      else {
        await consultarFiscal(doc.id, brand);
        await cargar();
      }
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const accesoCliente = async (doc: ComprobanteFiscal) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ url: string }>(
        `/fiscal/${encodeURIComponent(doc.id)}/acceso`,
        { method: "POST", body: JSON.stringify({ brand }) },
      );
      if (new URL(result.url).protocol !== "https:")
        throw new Error("El enlace del cliente debe usar HTTPS.");
      setAccesos((prev) => ({ ...prev, [doc.id]: result.url }));
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const enPruebas = datos?.config.environment !== "production";
  const emisor = datos?.config.emitters?.find((e) => e.id === emisorId);
  const configurado =
    datos?.config.enabled === true && (emisor?.enabled ?? true);
  const emisoresDisponibles = datos?.config.enabled === true;
  const hayActivo = datos?.comprobantes.some(
    (d) => !["rechazado", "anulado", "rejected"].includes(d.estado),
  );
  const puedeEmitir = admin && configurado && !hayActivo;

  return (
    <Modal
      open
      onClose={onClose}
      title="Comprobantes electrónicos"
      description={`Ficha ${String(fichaId).padStart(4, "0")} · ${clienteNombre}`}
      size="xl"
      elevated
      busy={busy}
      error={error}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            Cerrar
          </Button>
          {puedeEmitir &&
            (vista ? (
              <Button
                variant="brand"
                onClick={emitir}
                loading={busy}
                disabled={!acepta}
              >
                {incierto
                  ? "Recuperar emisión"
                  : enPruebas
                    ? "Emitir en pruebas"
                    : `Emitir ${nombreTipoFiscal(tipo).toLowerCase()}`}
              </Button>
            ) : (
              <Button variant="brand" onClick={revisar} loading={busy}>
                Revisar comprobante
              </Button>
            ))}
        </div>
      }
    >
      {loading ? (
        <p role="status" className="py-10 text-center text-gray-500">
          Cargando información fiscal…
        </p>
      ) : (
        datos && (
          <div className="space-y-6">
            <div
              className={`rounded-lg border p-4 text-sm ${enPruebas ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" : "border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"}`}
            >
              <p className="font-semibold">
                {enPruebas
                  ? "Ambiente de pruebas · sin validez tributaria"
                  : "Emisión en producción"}
              </p>
              {(emisor || datos.config.emitter) && (
                <p className="mt-1">
                  {(emisor || datos.config.emitter)!.razon_social} · RUC{" "}
                  {(emisor || datos.config.emitter)!.ruc}
                </p>
              )}
              {!configurado && (
                <p className="mt-1">
                  {emisor?.reason ||
                    datos.config.reason ||
                    "Falta configurar el emisor, certificado y series antes de emitir."}
                </p>
              )}
            </div>
            {aviso && (
              <p
                role="status"
                className="flex gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-100"
              >
                <CheckCircle2 className="size-5 shrink-0" />
                {aviso}
              </p>
            )}
            <section aria-label="Historial de comprobantes">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Historial de esta ficha
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={refrescar}
                  disabled={busy}
                >
                  <RefreshCw /> Actualizar
                </Button>
              </div>
              {!datos.comprobantes.length ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600">
                  Esta ficha todavía no tiene comprobantes electrónicos.
                </p>
              ) : (
                <div className="space-y-3">
                  {datos.comprobantes.map((doc) => (
                    <article
                      key={doc.id}
                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-600"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {nombreTipoFiscal(doc.tipo)} {doc.serie}-
                            {doc.numero}
                          </p>
                          <p className="text-sm text-gray-500">
                            {dineroFiscal(doc.total ?? doc.snapshot?.total)} ·{" "}
                            {doc.environment === "production"
                              ? "Producción"
                              : "Pruebas"}
                          </p>
                        </div>
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                          {estadoFiscal(doc.estado)}
                        </span>
                      </div>
                      {doc.mensaje && (
                        <p className="mt-2 break-words text-sm">
                          {doc.codigo ? `${doc.codigo}: ` : ""}
                          {doc.mensaje}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {admin && pendiente(doc.estado) && (
                          <Button
                            size="sm"
                            variant="subtle"
                            onClick={() => operarDocumento(doc)}
                            disabled={busy}
                          >
                            <RefreshCw /> Consultar estado
                          </Button>
                        )}
                        {(doc.archivos || []).map((archivo) => (
                          <Button
                            size="sm"
                            variant="subtle"
                            key={archivo}
                            disabled={busy}
                            onClick={() => operarDocumento(doc, archivo)}
                          >
                            <Download />{" "}
                            {archivo === "pdf"
                              ? "Representación imprimible"
                              : archivo.toUpperCase()}
                          </Button>
                        ))}
                        {admin &&
                          doc.archivos?.includes("pdf") &&
                          !accesos[doc.id] && (
                            <Button
                              size="sm"
                              variant="subtle"
                              disabled={busy}
                              onClick={() => accesoCliente(doc)}
                            >
                              Crear enlace para cliente
                            </Button>
                          )}
                      </div>
                      {accesos[doc.id] && (
                        <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-700">
                          <label className={etiqueta}>
                            Enlace privado del cliente
                            <input
                              className={campo}
                              readOnly
                              value={accesos[doc.id]}
                              onFocus={(e) => e.currentTarget.select()}
                            />
                          </label>
                          <p className="text-xs text-gray-500">
                            Disponible durante un año. Compártelo solo con el
                            receptor; reemplaza el enlace anterior de este
                            comprobante.
                          </p>
                          <a
                            href={accesos[doc.id]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 underline dark:text-blue-300"
                          >
                            Abrir acceso del cliente
                          </a>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
            {!admin && (
              <p className="text-sm text-gray-500">
                Un administrador debe revisar y emitir el comprobante.
              </p>
            )}
            {hayActivo && (
              <p className="flex gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-700">
                <AlertCircle className="size-5 shrink-0" />
                La operación ya tiene un comprobante registrado. Revisa su
                estado antes de cualquier corrección.
              </p>
            )}
            {admin && emisoresDisponibles && !hayActivo && (
              <section aria-label="Nuevo comprobante" className="space-y-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <FileCheck2 className="size-5" /> Nuevo comprobante
                </h3>
                <fieldset disabled={busy || incierto} className="space-y-4">
                  {!!datos.config.emitters?.length && (
                    <label className={etiqueta}>
                      Empresa que emite el comprobante
                      <select
                        className={campo}
                        value={emisorId}
                        onChange={(e) =>
                          cambiar(() => setEmisorId(e.target.value))
                        }
                      >
                        {datos.config.emitters.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.razon_social} · RUC {e.ruc}
                            {e.enabled ? "" : " · no habilitado"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={etiqueta}>
                      Tipo de comprobante
                      <select
                        className={campo}
                        value={tipo}
                        onChange={(e) =>
                          cambiar(() => {
                            setTipo(e.target.value as "01" | "03");
                            if (e.target.value === "01")
                              setReceptor((r) => ({
                                ...r,
                                tipo_documento: "6",
                              }));
                            else {
                              setFormaPago("Contado");
                              setCuotas([]);
                            }
                          })
                        }
                      >
                        <option value="01">Factura</option>
                        <option value="03">Boleta de venta</option>
                      </select>
                    </label>
                    <div>
                      <p className={etiqueta}>Serie</p>
                      <p className="py-3 text-sm">
                        {emisor?.series?.[tipo] ||
                          datos.config.series?.[tipo] ||
                          "Por configurar"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={etiqueta}>
                      Documento del receptor
                      <select
                        className={campo}
                        value={receptor.tipo_documento}
                        onChange={(e) =>
                          cambiar(() =>
                            setReceptor((r) => ({
                              ...r,
                              tipo_documento: e.target.value,
                            })),
                          )
                        }
                        disabled={tipo === "01"}
                      >
                        <option value="6">RUC</option>
                        <option value="1">DNI</option>
                        <option value="4">Carné de extranjería</option>
                      </select>
                    </label>
                    <label className={etiqueta}>
                      Número de documento
                      <input
                        className={campo}
                        value={receptor.numero_documento}
                        maxLength={15}
                        onChange={(e) =>
                          cambiar(() =>
                            setReceptor((r) => ({
                              ...r,
                              numero_documento: e.target.value.trim(),
                            })),
                          )
                        }
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  <label className={etiqueta}>
                    Nombre o razón social fiscal
                    <input
                      className={campo}
                      value={receptor.razon_social}
                      maxLength={250}
                      onChange={(e) =>
                        cambiar(() =>
                          setReceptor((r) => ({
                            ...r,
                            razon_social: e.target.value,
                          })),
                        )
                      }
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={etiqueta}>
                      Dirección fiscal
                      <input
                        className={campo}
                        value={receptor.direccion}
                        maxLength={300}
                        onChange={(e) =>
                          cambiar(() =>
                            setReceptor((r) => ({
                              ...r,
                              direccion: e.target.value,
                            })),
                          )
                        }
                      />
                    </label>
                    <label className={etiqueta}>
                      Correo del receptor (opcional)
                      <input
                        className={campo}
                        type="email"
                        value={receptor.email}
                        maxLength={250}
                        onChange={(e) =>
                          cambiar(() =>
                            setReceptor((r) => ({
                              ...r,
                              email: e.target.value,
                            })),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={etiqueta}>
                      Afectación tributaria
                      <select
                        className={campo}
                        value={afectacion}
                        onChange={(e) =>
                          cambiar(() =>
                            setAfectacion(e.target.value as "10" | "20" | "30"),
                          )
                        }
                      >
                        <option value="10">Gravado · IGV 18%</option>
                        <option value="20" disabled>
                          Exonerado · pendiente de configuración
                        </option>
                        <option value="30" disabled>
                          Inafecto · pendiente de configuración
                        </option>
                      </select>
                    </label>
                    <label className={etiqueta}>
                      Forma de pago
                      <select
                        className={campo}
                        value={formaPago}
                        onChange={(e) =>
                          cambiar(() =>
                            setFormaPago(
                              e.target.value as "Contado" | "Credito",
                            ),
                          )
                        }
                      >
                        <option value="Contado">Contado</option>
                        <option value="Credito" disabled={tipo === "03"}>
                          Crédito{tipo === "03" ? " · solo factura" : ""}
                        </option>
                      </select>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Los precios de la ficha incluyen impuestos cuando
                    corresponden. La afectación debe estar autorizada para el
                    emisor.
                  </p>
                  <p className="text-xs text-gray-500">
                    Emisión de la operación completa. Anticipos separados,
                    detracciones y correcciones mediante notas requieren su
                    configuración fiscal antes de emitir.
                  </p>
                  {formaPago === "Credito" && (
                    <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                      <p className="text-sm">
                        Pendiente registrado:{" "}
                        {dineroFiscal(
                          Number(datos.defaults.total) -
                            Number(datos.defaults.abonado),
                        )}
                        . Define las cuotas acordadas.
                      </p>
                      {cuotas.map((cuota, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
                        >
                          <label className={etiqueta}>
                            Vencimiento {index + 1}
                            <input
                              type="date"
                              className={campo}
                              value={cuota.fecha}
                              onChange={(e) =>
                                cambiar(() =>
                                  setCuotas((prev) =>
                                    prev.map((q, i) =>
                                      i === index
                                        ? { ...q, fecha: e.target.value }
                                        : q,
                                    ),
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className={etiqueta}>
                            Monto {index + 1}
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className={campo}
                              value={cuota.monto || ""}
                              onChange={(e) =>
                                cambiar(() =>
                                  setCuotas((prev) =>
                                    prev.map((q, i) =>
                                      i === index
                                        ? {
                                            ...q,
                                            monto: Number(e.target.value),
                                          }
                                        : q,
                                    ),
                                  ),
                                )
                              }
                            />
                          </label>
                          <Button
                            variant="ghost"
                            className="mb-1"
                            aria-label={`Eliminar cuota ${index + 1}`}
                            onClick={() =>
                              cambiar(() =>
                                setCuotas((q) =>
                                  q.filter((_, i) => i !== index),
                                ),
                              )
                            }
                          >
                            Quitar
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="subtle"
                        disabled={cuotas.length >= 12}
                        onClick={() =>
                          cambiar(() =>
                            setCuotas((q) => [...q, { fecha: "", monto: 0 }]),
                          )
                        }
                      >
                        Añadir cuota
                      </Button>
                    </div>
                  )}
                </fieldset>
                {vista && (
                  <div
                    ref={revision}
                    className="space-y-4 rounded-lg border border-blue-200 p-4 dark:border-blue-800"
                    aria-label="Revisión del comprobante"
                  >
                    <h4 className="font-semibold">Revisión antes de emitir</h4>
                    <p className="break-words text-sm">
                      Emite: {vista.snapshot.emisor.razon_social} · RUC{" "}
                      {vista.snapshot.emisor.ruc}
                    </p>
                    <p className="break-words text-sm">
                      {nombreTipoFiscal(vista.snapshot.tipo)} para{" "}
                      {vista.snapshot.receptor.razon_social} ·{" "}
                      {vista.snapshot.receptor.numero_documento}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="py-2">Concepto</th>
                            <th className="px-3 py-2 text-right">Cant.</th>
                            <th className="py-2 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vista.snapshot.lineas.map((l, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 dark:border-gray-700"
                            >
                              <td className="min-w-36 py-2 pr-2 break-words">
                                {l.descripcion}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {l.cantidad}
                              </td>
                              <td className="whitespace-nowrap py-2 text-right">
                                {dineroFiscal(l.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <dl className="ml-auto max-w-xs space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt>Valor de venta</dt>
                        <dd>{dineroFiscal(vista.snapshot.base)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>IGV</dt>
                        <dd>{dineroFiscal(vista.snapshot.igv)}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                        <dt>Total</dt>
                        <dd>{dineroFiscal(vista.snapshot.total)}</dd>
                      </div>
                    </dl>
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-orange-500"
                        checked={acepta}
                        disabled={busy}
                        onChange={(e) => setAcepta(e.target.checked)}
                      />
                      <span>
                        He revisado el receptor, los conceptos, los impuestos y
                        la forma de pago.
                        {enPruebas
                          ? " Este documento será de prueba."
                          : " Confirmo la emisión tributaria de esta operación."}
                      </span>
                    </label>
                  </div>
                )}
              </section>
            )}
          </div>
        )
      )}
    </Modal>
  );
}
