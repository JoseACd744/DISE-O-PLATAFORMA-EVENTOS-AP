import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { campo, etiqueta } from "../lib/ui";
import { apiRequest } from "../lib/api";
import {
  descargarResumenFiscal,
  estadoFiscal,
  nombreTipoFiscal,
  type DatosFiscales,
} from "../lib/fiscal";

async function zipBase64(file: File) {
  if (!/\.zip$/i.test(file.name) || file.size > 2 * 1024 * 1024 || !file.size)
    throw new Error("Selecciona el ZIP de la CDR de SUNAT, de hasta 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export function FiscalRecoveryPanel({
  datos,
  brand,
  busy,
  onAction,
}: {
  datos: DatosFiscales;
  brand: string;
  busy: boolean;
  onAction: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [docId, setDocId] = useState(""),
    [motivo, setMotivo] = useState(""),
    [confirmado, setConfirmado] = useState(false),
    [seleccionados, setSeleccionados] = useState<string[]>([]),
    [tickets, setTickets] = useState<Record<string, string>>({});
  const key = useRef(crypto.randomUUID());
  const doc = datos.comprobantes.find((d) => String(d.id) === docId);
  const resumenables = datos.comprobantes.filter(
    (d) =>
      d.can_summary ??
      ((d.tipo === "03" ||
        (["07", "08"].includes(d.tipo) &&
          d.snapshot?.referencia?.tipo === "03")) &&
        ["queued", "blocked"].includes(d.estado)),
  );
  const seleccionVigente = seleccionados.filter((id) =>
    resumenables.some((d) => String(d.id) === id),
  );
  const post = (path: string, body: unknown, idem = false) =>
    apiRequest(path, {
      method: "POST",
      body: JSON.stringify({ brand, ...(body as object) }),
      ...(idem ? { headers: { "Idempotency-Key": key.current } } : {}),
    });
  const cambiarDocumento = (id: string) => {
    setDocId(id);
    setMotivo("");
    setConfirmado(false);
    key.current = crypto.randomUUID();
  };
  const conciliar = (file: File, id: string, batch = false) =>
    onAction(
      async () =>
        post(
          batch
            ? `/fiscal/resumenes/${id}/conciliar`
            : `/fiscal/${id}/conciliar`,
          { cdr_zip_base64: await zipBase64(file) },
        ),
      "CDR verificada y estado actualizado.",
    );
  return (
    <details className="rounded-lg border border-gray-200 p-4 dark:border-gray-600">
      <summary className="cursor-pointer font-semibold">
        Recuperación, resúmenes y bajas
      </summary>
      <div className="mt-4 space-y-5">
        <p className="text-xs text-gray-500">
          Las respuestas inciertas se concilian antes de volver a emitir. Una
          CDR cargada debe tener firma válida de SUNAT y corresponder al
          documento.
        </p>
        {!!datos.comprobantes.length && (
          <div className="space-y-3">
            <label className={etiqueta}>
              Documento para gestionar
              <select
                className={campo}
                value={docId}
                disabled={busy}
                onChange={(e) => cambiarDocumento(e.target.value)}
              >
                <option value="">Selecciona un comprobante</option>
                {datos.comprobantes.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {nombreTipoFiscal(d.tipo)} {d.serie}-{d.numero} ·{" "}
                    {estadoFiscal(d.estado)}
                  </option>
                ))}
              </select>
            </label>
            {doc && (
              <>
                {doc.environment !== "production" &&
                  !["rejected", "voided"].includes(doc.estado) && (
                    <label className={etiqueta}>
                      Conciliar con CDR firmada de SUNAT
                      <input
                        className={campo}
                        type="file"
                        accept=".zip,application/zip"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void conciliar(f, String(doc.id));
                        }}
                      />
                    </label>
                  )}
                {doc.can_void && (
                  <div className="space-y-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950">
                    <label className={etiqueta}>
                      Motivo de la baja
                      <input
                        className={campo}
                        maxLength={250}
                        value={motivo}
                        disabled={busy}
                        onChange={(e) => {
                          setMotivo(e.target.value);
                          key.current = crypto.randomUUID();
                        }}
                      />
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={confirmado}
                        disabled={busy}
                        onChange={(e) => setConfirmado(e.target.checked)}
                      />
                      <span>
                        Confirmo que el comprobante no fue entregado ni puesto a
                        disposición del cliente. La baja se enviará a SUNAT.
                      </span>
                    </label>
                    <Button
                      variant="subtle"
                      disabled={busy || !confirmado || !motivo.trim()}
                      onClick={() =>
                        onAction(
                          () =>
                            post(`/fiscal/${doc.id}/anular`, { motivo }, true),
                          "Baja registrada para su envío y seguimiento.",
                        )
                      }
                    >
                      Solicitar baja
                    </Button>
                  </div>
                )}
                {!doc.otorgado_at &&
                  ["accepted", "observed"].includes(doc.estado) && (
                    <Button
                      variant="subtle"
                      disabled={busy}
                      onClick={() =>
                        onAction(
                          () => post(`/fiscal/${doc.id}/otorgar`, {}),
                          "Comprobante marcado como entregado. Cualquier corrección posterior requiere una nota.",
                        )
                      }
                    >
                      Registrar entrega al cliente
                    </Button>
                  )}
                {doc.otorgado_at && (
                  <p className="text-xs text-gray-500">
                    Entregado o puesto a disposición del cliente. Para
                    corregirlo, utiliza una nota.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {!!resumenables.length && (
          <section className="space-y-3">
            <h4 className="font-semibold">Informar boletas mediante resumen</h4>
            <p className="text-xs text-gray-500">
              Solo documentos sin intento individual o habilitados por el
              servidor. Selecciona una misma empresa y fecha.
            </p>
            {resumenables.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(String(d.id))}
                  disabled={busy}
                  onChange={(e) => {
                    setSeleccionados((prev) =>
                      e.target.checked
                        ? [...prev, String(d.id)]
                        : prev.filter((id) => id !== String(d.id)),
                    );
                    key.current = crypto.randomUUID();
                  }}
                />
                <span>
                  {d.snapshot?.fecha_emision} · {d.serie}-{d.numero}
                </span>
              </label>
            ))}
            <Button
              variant="subtle"
              disabled={busy || !seleccionVigente.length}
              onClick={() =>
                onAction(() => {
                  const first = datos.comprobantes.find(
                    (d) => String(d.id) === seleccionVigente[0],
                  );
                  return post(
                    "/fiscal/resumenes",
                    {
                      emisor_id: first?.snapshot?.emisor.id,
                      tipo: "RC",
                      accion: "1",
                      documento_ids: seleccionVigente,
                      fecha_emision: first?.snapshot?.fecha_emision,
                    },
                    true,
                  );
                }, "Resumen registrado. Consulta su ticket y respuesta.")
              }
            >
              Crear resumen diario
            </Button>
          </section>
        )}
        {!!datos.resumenes?.length && (
          <section aria-label="Seguimiento de resúmenes" className="space-y-3">
            <h4 className="font-semibold">
              Resúmenes y comunicaciones de baja
            </h4>
            {datos.resumenes.map((job) => (
              <article
                className="space-y-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-600"
                key={job.id}
              >
                <p className="font-medium">
                  {job.identificador} · {estadoFiscal(job.estado)}
                </p>
                {job.mensaje && <p className="break-words">{job.mensaje}</p>}
                {job.ticket ? (
                  <p>Ticket SUNAT: {job.ticket}</p>
                ) : (
                  <label className={etiqueta}>
                    Ticket recuperado en SUNAT (si hubo respuesta perdida)
                    <input
                      className={campo}
                      maxLength={100}
                      value={tickets[job.id] || ""}
                      disabled={busy}
                      onChange={(e) =>
                        setTickets((prev) => ({
                          ...prev,
                          [job.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="subtle"
                    disabled={busy}
                    onClick={() =>
                      onAction(
                        () =>
                          post(`/fiscal/resumenes/${job.id}/consultar`, {
                            ...(tickets[job.id]
                              ? { ticket: tickets[job.id] }
                              : {}),
                          }),
                        "Consulta del resumen programada.",
                      )
                    }
                  >
                    Consultar resumen
                  </Button>
                  {(["xml", "cdr"] as const).map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant="subtle"
                      disabled={busy}
                      onClick={() =>
                        onAction(
                          () =>
                            descargarResumenFiscal(String(job.id), type, brand),
                          "Archivo del resumen descargado.",
                        )
                      }
                    >
                      {type.toUpperCase()}
                    </Button>
                  ))}
                </div>
                {datos.config.environment !== "production" && (
                  <label className={etiqueta}>
                    CDR firmada del resumen
                    <input
                      className={campo}
                      type="file"
                      accept=".zip,application/zip"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void conciliar(f, String(job.id), true);
                      }}
                    />
                  </label>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </details>
  );
}
