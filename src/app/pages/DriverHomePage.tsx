import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation, MapPin, Clock3, CheckCircle2, PlayCircle, PauseCircle, Download } from "lucide-react";
import { apiRequest } from "../lib/api";
import { getLocalDateString, parseLocalDate } from "../lib/date";
import { getAuthUser } from "../lib/auth";
import { mensajeDeError, notify } from "../lib/notify";
import { ErrorBanner } from "../components/ui/feedback";
import { Button } from "../components/ui/button";

const MENSAJES_GPS: Record<number, string> = {
  1: "Permiso de ubicación denegado. Actívalo en la configuración del navegador para compartir tu ubicación.",
  2: "No se pudo determinar tu ubicación. Revisa que el GPS esté encendido.",
  3: "El GPS tardó demasiado en responder. Inténtalo de nuevo al aire libre.",
};

type AssignmentStatus = "programada" | "en-curso" | "completada";

type Assignment = {
  id: number;
  chofer_id: number;
  vehiculo_id: number | null;
  fecha: string;
  ruta: string;
  entregas: number;
  estado: AssignmentStatus;
  fichas_ids: number[];
  vehiculo?: { placa?: string; modelo?: string };
};

type Ficha = {
  id: number;
  cliente_nombre: string;
  direccion: string;
  distrito: string;
  hora_entrega?: string;
};

type GpsSnapshot = {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
};

const GPS_CACHE_KEY = "driverGpsCache";
// El GPS entrega una lectura cada pocos segundos: solo se envía/guarda cada 30 s o al moverse 50 m
const GPS_INTERVALO_MS = 30_000;
const GPS_DISTANCIA_M = 50;

function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function DriverHomePage() {
  const authUser = getAuthUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fichasById, setFichasById] = useState<Record<number, Ficha>>({});
  const [tracking, setTracking] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [lastPosition, setLastPosition] = useState<GpsSnapshot | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string>("");
  const [actualizando, setActualizando] = useState<number | null>(null);
  const watcherRef = useRef<number | null>(null);
  const ultimoEnvioRef = useRef<{ t: number; lat: number; lng: number } | null>(null);

  const today = getLocalDateString();
  const choferId = Number(authUser?.id || 0);

  const loadData = async () => {
    if (!choferId) {
      setLoading(false);
      setError("No se pudo identificar tu usuario de chofer. Cierra sesión y vuelve a ingresar.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const list = await apiRequest<Assignment[]>(`/logistics/asignaciones?fecha=${today}`);
      const mine = list.filter((a) => a.chofer_id === choferId);
      setAssignments(mine);

      const fichaIds = Array.from(new Set(mine.flatMap((a) => Array.isArray(a.fichas_ids) ? a.fichas_ids : [])));
      if (!fichaIds.length) {
        setFichasById({});
        return;
      }

      const fichas = await Promise.all(fichaIds.map((id) => apiRequest<Ficha>(`/fichas/${id}`)));
      const mapped = fichas.reduce<Record<number, Ficha>>((acc, f) => {
        acc[f.id] = f;
        return acc;
      }, {});
      setFichasById(mapped);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudieron cargar tus rutas."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [choferId]);

  useEffect(() => {
    return () => {
      if (watcherRef.current !== null) {
        navigator.geolocation.clearWatch(watcherRef.current);
      }
    };
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setGpsError("Este dispositivo no permite obtener la ubicación.");
      return;
    }

    setGpsError("");
    setTracking(true);
    ultimoEnvioRef.current = null;

    watcherRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const snapshot: GpsSnapshot = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: Math.max(0, Math.round((position.coords.speed || 0) * 3.6)),
          heading: Math.round(position.coords.heading || 0),
          timestamp: new Date().toISOString(),
        };

        setLastPosition(snapshot);

        const ultimo = ultimoEnvioRef.current;
        const ahora = Date.now();
        if (ultimo && ahora - ultimo.t < GPS_INTERVALO_MS && distanciaMetros(ultimo, snapshot) < GPS_DISTANCIA_M) return;
        ultimoEnvioRef.current = { t: ahora, lat: snapshot.lat, lng: snapshot.lng };

        // Si backend aun no tiene endpoint de posiciones, se guarda local para no perder tracking.
        const localCache = JSON.parse(localStorage.getItem(GPS_CACHE_KEY) || "[]") as GpsSnapshot[];
        localCache.push(snapshot);
        localStorage.setItem(GPS_CACHE_KEY, JSON.stringify(localCache.slice(-300)));

        try {
          await apiRequest("/logistics/positions", {
            method: "POST",
            silencioso: true,
            body: JSON.stringify({
              chofer_id: choferId,
              lat: snapshot.lat,
              lng: snapshot.lng,
              speed: snapshot.speed,
              heading: snapshot.heading,
              timestamp: snapshot.timestamp,
            }),
          });
          setLastSentAt(new Date().toLocaleTimeString("es-PE"));
        } catch {
          // Fallback local: seguimos enviando al cache.
          setLastSentAt(`${new Date().toLocaleTimeString("es-PE")} (guardado en el teléfono)`);
        }
      },
      (err) => {
        setGpsError(MENSAJES_GPS[err.code] || "No se pudo obtener la ubicación.");
        // Sin permiso no tiene sentido seguir intentando
        if (err.code === 1) stopTracking();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const stopTracking = () => {
    if (watcherRef.current !== null) {
      navigator.geolocation.clearWatch(watcherRef.current);
      watcherRef.current = null;
    }
    setTracking(false);
  };

  const updateAssignmentStatus = async (assignment: Assignment, status: AssignmentStatus) => {
    if (actualizando !== null) return;
    setActualizando(assignment.id);
    try {
      await apiRequest(`/logistics/asignaciones/${assignment.id}`, {
        method: "PUT",
        body: JSON.stringify({ estado: status }),
      });
      notify.ok(status === "completada" ? "Ruta marcada como completada" : "Ruta iniciada");
      await loadData();
    } catch (err) {
      notify.error(err, "No se pudo actualizar el estado de la ruta.");
    } finally {
      setActualizando(null);
    }
  };

  const handleGenerarHojaRuta = async (asig: Assignment) => {
    try {
      // Las fichas del día ya están cargadas: solo se piden las que falten
      const fullFichas = await Promise.all(
        asig.fichas_ids.map(id => (fichasById[id] as any) ?? apiRequest<any>(`/fichas/${id}`))
      );

      const popup = window.open("", `hoja-ruta-${asig.id}`, "width=1000,height=800");
      if (!popup) {
        notify.aviso("El navegador bloqueó la ventana de la hoja de ruta. Permite las ventanas emergentes e inténtalo de nuevo.");
        return;
      }

      const escapeHtml = (val: string) => (val || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const formatMoney = (n: number) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const rowsHtml = fullFichas.map((f, idx) => {
        const total = Number(f.cotizacion || 0) * (1 - Number(f.descuento || 0) / 100);
        const abonado = (f.abonos || []).reduce((s: number, a: any) => s + Number(a.monto || 0), 0);
        const saldo = Math.max(0, total - abonado);
        
        const paquetesStr = (f.paquetes || []).map((p: any) => `${p.cantidad}x ${p.paquete_nombre}`).join(", ");
        const productosStr = (f.productosSueltos || []).map((p: any) => `${p.cantidad}x ${p.producto_nombre}`).join(", ");
        const itemsStr = [paquetesStr, productosStr].filter(Boolean).join(" | ");

        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>
              <strong>${escapeHtml(f.cliente_nombre)}</strong><br/>
              <small>${escapeHtml(f.cliente_celular)}</small>
            </td>
            <td>
              ${escapeHtml(f.direccion)}, ${escapeHtml(f.distrito)}<br/>
              <small>Ref: ${escapeHtml(f.referencia || "-")}</small>
            </td>
            <td style="text-align:center;">
              ${escapeHtml(f.hora_entrega)}<br/>
              <small>Recojo: ${escapeHtml(f.hora_recojo)}</small>
            </td>
            <td>${escapeHtml(itemsStr || "Sin productos")}</td>
            <td style="text-align:right; font-weight:bold; color:${saldo > 0 ? "#e11d48" : "#16a34a"};">
              ${formatMoney(saldo)}
            </td>
          </tr>
        `;
      }).join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Hoja de Ruta - ${asig.ruta}</title>
            <style>
              body { font-family: sans-serif; color: #333; margin: 20px; font-size: 12px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1F3C8B; padding-bottom: 10px; }
              .header h1 { margin: 0; color: #1F3C8B; font-size: 24px; }
              .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
              .meta div b { display: block; color: #666; font-size: 10px; text-transform: uppercase; margin-bottom: 2px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f2f2f2; font-weight: bold; }
              .actions { position: sticky; top: 0; background: white; padding: 10px; display: flex; justify-content: center; gap: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
              button { padding: 8px 16px; cursor: pointer; background: #1F3C8B; color: white; border: none; border-radius: 4px; }
              button.secondary { background: #666; }
              @media print { .actions { display: none; } body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="actions">
              <button onclick="window.print()">Imprimir / Guardar PDF</button>
              <button class="secondary" onclick="window.close()">Cerrar</button>
            </div>
            <div class="header">
              <div>
                <h1>Hoja de Ruta</h1>
                <p style="margin: 5px 0 0;">${escapeHtml(asig.ruta || "Ruta General")}</p>
              </div>
              <div style="text-align: right;">
                <p><b>Fecha:</b> ${parseLocalDate(asig.fecha).toLocaleDateString("es-PE")}</p>
                <p><b>ID Asignación:</b> #${asig.id}</p>
              </div>
            </div>
            <div class="meta">
              <div><b>Chofer</b> ${escapeHtml(authUser?.nombre || "-")}</div>
              <div><b>Vehículo</b> Placa: ${asig.vehiculo?.placa || "-"} · ${asig.vehiculo?.modelo || ""}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th>Cliente</th>
                  <th>Dirección</th>
                  <th style="width: 100px;">Horario</th>
                  <th>Productos</th>
                  <th style="width: 80px;">Saldo</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <div style="margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 10px; color: #666;">
              <p><b>Comentarios de Ruta:</b> ________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________</p>
            </div>
          </body>
        </html>
      `;

      popup.document.open();
      popup.document.write(html);
      popup.document.close();
    } catch (err) {
      notify.error(err, "No se pudo generar la hoja de ruta.");
    }
  };

  const summary = useMemo(() => {
    const inRoute = assignments.filter((a) => a.estado === "en-curso").length;
    const done = assignments.filter((a) => a.estado === "completada").length;
    return { total: assignments.length, inRoute, done };
  }, [assignments]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-3">
        <StatCard label="Rutas" value={summary.total} />
        <StatCard label="En curso" value={summary.inRoute} />
        <StatCard label="Completadas" value={summary.done} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm text-gray-900 dark:text-white">Compartir ubicación</h2>
          {tracking ? (
            <button
              onClick={stopTracking}
              className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300"
            >
              <PauseCircle className="h-4 w-4" />
              Detener
            </button>
          ) : (
            <button
              onClick={startTracking}
              className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300"
            >
              <PlayCircle className="h-4 w-4" />
              Iniciar
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Último envío: {lastSentAt || "Sin datos"}
        </p>

        {lastPosition ? (
          <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">
            {lastPosition.lat.toFixed(5)}, {lastPosition.lng.toFixed(5)} · {lastPosition.speed} km/h
          </p>
        ) : null}

        {gpsError ? (
          <ErrorBanner tone="warning" className="mt-3">{gpsError}</ErrorBanner>
        ) : null}
      </section>

      {error ? (
        <ErrorBanner onRetry={choferId ? loadData : undefined}>{error}</ErrorBanner>
      ) : null}

      <section className="space-y-3 pb-6">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            Cargando rutas...
          </div>
        ) : error ? null : assignments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            No tienes rutas asignadas para hoy.
          </div>
        ) : (
          assignments.map((assignment) => (
            <article key={assignment.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{assignment.ruta || `Ruta #${assignment.id}`}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {parseLocalDate(assignment.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })} · {assignment.vehiculo?.placa || "Sin vehículo"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleGenerarHojaRuta(assignment)}
                    className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-brand-navy/10 dark:hover:text-blue-400 rounded-lg transition-colors"
                    title="Descargar Hoja de Ruta"
                    aria-label="Descargar Hoja de Ruta"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <StatusPill status={assignment.estado} />
                </div>
              </div>

              <div className="space-y-2">
                {(assignment.fichas_ids || []).map((fichaId) => {
                  const ficha = fichasById[fichaId];
                  if (!ficha) return null;
                  const destination = `${ficha.direccion}, ${ficha.distrito}`;
                  return (
                    <div key={fichaId} className="min-w-0 rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                      <p className="text-sm text-gray-900 dark:text-white break-words">{ficha.cliente_nombre}</p>
                      <div className="mt-1 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-words">{destination}</span>
                      </div>
                      {ficha.hora_entrega ? (
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock3 className="h-3.5 w-3.5" /> Entrega: {ficha.hora_entrega}
                        </div>
                      ) : null}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-brand-navy dark:text-blue-400 hover:underline"
                      >
                        <Navigation className="h-3.5 w-3.5" /> Navegar
                      </a>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2">
                {assignment.estado !== "en-curso" ? (
                  <Button variant="outline" size="sm" className="flex-1 text-blue-700 dark:text-blue-300"
                    loading={actualizando === assignment.id} disabled={actualizando !== null}
                    onClick={() => updateAssignmentStatus(assignment, "en-curso")}>
                    Iniciar ruta
                  </Button>
                ) : null}

                {assignment.estado !== "completada" ? (
                  <Button variant="outline" size="sm" className="flex-1 text-green-700 dark:text-green-300"
                    loading={actualizando === assignment.id} disabled={actualizando !== null}
                    onClick={() => updateAssignmentStatus(assignment, "completada")}>
                    Marcar completada
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>

    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl text-gray-900 dark:text-white tabular-nums truncate">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: AssignmentStatus }) {
  if (status === "completada") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[11px] text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 className="h-3 w-3" /> Completada</span>;
  }
  if (status === "en-curso") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[11px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">En curso</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Programada</span>;
}
