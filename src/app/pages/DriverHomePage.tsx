import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation, MapPin, Clock3, CheckCircle2, PlayCircle, PauseCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "../lib/api";
import { getAuthUser } from "../lib/auth";

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
  const watcherRef = useRef<number | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const choferId = Number(authUser?.id || 0);

  const loadData = async () => {
    if (!choferId) return;

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
      setError(err instanceof Error ? err.message : "No se pudieron cargar tus rutas");
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
      setGpsError("Este dispositivo no soporta geolocalizacion");
      return;
    }

    setGpsError("");
    setTracking(true);

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

        // Si backend aun no tiene endpoint de posiciones, se guarda local para no perder tracking.
        const localCache = JSON.parse(localStorage.getItem(GPS_CACHE_KEY) || "[]") as GpsSnapshot[];
        localCache.push(snapshot);
        localStorage.setItem(GPS_CACHE_KEY, JSON.stringify(localCache.slice(-300)));

        try {
          await apiRequest("/logistics/positions", {
            method: "POST",
            body: JSON.stringify({
              chofer_id: choferId,
              lat: snapshot.lat,
              lng: snapshot.lng,
              speed: snapshot.speed,
              heading: snapshot.heading,
              timestamp: snapshot.timestamp,
            }),
          });
          setLastSentAt(new Date().toLocaleTimeString());
        } catch {
          // Fallback local: seguimos enviando al cache.
          setLastSentAt(`Local ${new Date().toLocaleTimeString()}`);
        }
      },
      (err) => {
        setGpsError(err.message || "No se pudo obtener la ubicacion");
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
    try {
      await apiRequest(`/logistics/asignaciones/${assignment.id}`, {
        method: "PUT",
        body: JSON.stringify({ estado: status }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado");
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
          <h2 className="text-sm text-gray-900 dark:text-white">Tracking GPS</h2>
          {tracking ? (
            <button
              onClick={stopTracking}
              className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <PauseCircle className="h-4 w-4" />
              Detener
            </button>
          ) : (
            <button
              onClick={startTracking}
              className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700"
            >
              <PlayCircle className="h-4 w-4" />
              Iniciar
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Ultimo envio: {lastSentAt || "Sin datos"}
        </p>

        {lastPosition ? (
          <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">
            {lastPosition.lat.toFixed(5)}, {lastPosition.lng.toFixed(5)} · {lastPosition.speed} km/h
          </p>
        ) : null}

        {gpsError ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {gpsError}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : null}

      <section className="space-y-3 pb-6">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800">
            Cargando rutas...
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800">
            No tienes rutas asignadas para hoy.
          </div>
        ) : (
          assignments.map((assignment) => (
            <article key={assignment.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">{assignment.ruta || `Ruta #${assignment.id}`}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {assignment.fecha} · {assignment.vehiculo?.placa || "Sin vehiculo"}
                  </p>
                </div>
                <StatusPill status={assignment.estado} />
              </div>

              <div className="space-y-2">
                {(assignment.fichas_ids || []).map((fichaId) => {
                  const ficha = fichasById[fichaId];
                  if (!ficha) return null;
                  const destination = `${ficha.direccion}, ${ficha.distrito}`;
                  return (
                    <div key={fichaId} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                      <p className="text-sm text-gray-900 dark:text-white">{ficha.cliente_nombre}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="h-3.5 w-3.5" /> {destination}
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
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#1F3C8B] hover:underline"
                      >
                        <Navigation className="h-3.5 w-3.5" /> Navegar
                      </a>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2">
                {assignment.estado !== "en-curso" ? (
                  <button
                    onClick={() => updateAssignmentStatus(assignment, "en-curso")}
                    className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700"
                  >
                    Iniciar ruta
                  </button>
                ) : null}

                {assignment.estado !== "completada" ? (
                  <button
                    onClick={() => updateAssignmentStatus(assignment, "completada")}
                    className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700"
                  >
                    Marcar completada
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-[#1F3C8B]/20 bg-[#1F3C8B]/5 px-3 py-2 text-xs text-[#1F3C8B]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Si el backend aun no tiene /logistics/positions, el tracking queda guardado localmente y no bloquea la operacion.
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: AssignmentStatus }) {
  if (status === "completada") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[11px] text-green-700"><CheckCircle2 className="h-3 w-3" /> Completada</span>;
  }
  if (status === "en-curso") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[11px] text-blue-700">En curso</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700">Programada</span>;
}
