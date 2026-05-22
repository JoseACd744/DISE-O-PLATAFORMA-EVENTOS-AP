import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin, Clock, Calendar,
  Truck, User, Loader2, Car,
  GripVertical, ChevronsUp, ChevronsDown,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import { useBrand } from "../contexts/BrandContext";

// ── Types ────────────────────────────────────────────────────────

interface FichaPin {
  id: number;
  clienteNombre: string;
  direccion: string;
  distrito: string;
  horaEntrega: string;
  brand: "donofrio" | "jugueton";
}

interface VehiculoRuta {
  id: number;
  placa: string;
  modelo: string;
  chofer: string;
  estado: "disponible" | "en-ruta" | "mantenimiento";
  fichas: FichaPin[];
}

type GeocodedFicha = FichaPin & { lat: number; lng: number };

// ── Helpers ──────────────────────────────────────────────────────

function sortFichasByTime(fichas: FichaPin[]): FichaPin[] {
  return [...fichas].sort((a, b) => {
    if (!a.horaEntrega && !b.horaEntrega) return 0;
    if (!a.horaEntrega) return 1;
    if (!b.horaEntrega) return -1;
    return a.horaEntrega.localeCompare(b.horaEntrega);
  });
}

// ── Geocoding ────────────────────────────────────────────────────

const geocodeCache = new Map<string, { lat: number; lng: number }>();

async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const cached = geocodeCache.get(query);
  if (cached) return cached;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=pe`;
    const res = await fetch(url, { headers: { "User-Agent": "EventosPlatforma/1.0" } });
    const data = await res.json();
    if (data.length > 0) {
      const loc = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(query, loc);
      return loc;
    }
  } catch { /* skip */ }
  return null;
}

// ── OSRM road routing (max 25 waypoints) ─────────────────────────

async function fetchRoadRoute(points: { lat: number; lng: number }[]): Promise<[number, number][]> {
  if (points.length < 2) return [];
  const capped = points.slice(0, 25);
  try {
    const coords = capped.map(p => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.[0]) {
      // OSRM returns [lng, lat]; Leaflet needs [lat, lng]
      return data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );
    }
  } catch { /* skip */ }
  return [];
}

// ── Leaflet icons ────────────────────────────────────────────────

type PinType = "normal" | "start" | "end";

function createNumberedIcon(num: number, color: string, type: PinType) {
  const border = type === "start" ? "#22c55e" : type === "end" ? "#ef4444" : "#fff";
  const badge =
    type === "start"
      ? `<div style="position:absolute;top:-5px;right:-5px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`
      : type === "end"
      ? `<div style="position:absolute;top:-5px;right:-5px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="white"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`
      : "";
  return L.divIcon({
    html: `<div style="position:relative;width:36px;height:36px"><div style="width:36px;height:36px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2.5px solid ${border};box-shadow:0 2px 8px rgba(0,0,0,0.35)">${num}</div>${badge}</div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  });
}

// ── FitBounds ────────────────────────────────────────────────────

function FitBounds({ pins }: { pins: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  const prevKey = useRef("");
  useEffect(() => {
    if (pins.length === 0) return;
    const key = pins.map(p => `${p.lat},${p.lng}`).join("|");
    if (key === prevKey.current) return;
    prevKey.current = key;
    map.fitBounds(L.latLngBounds(pins.map(p => [p.lat, p.lng] as [number, number])), {
      padding: [60, 60],
      maxZoom: 14,
    });
  }, [map, pins]);
  return null;
}

// ── Draggable ficha row ───────────────────────────────────────────

interface FichaRowProps {
  ficha: GeocodedFicha;
  idx: number;
  total: number;
  isDragOver: boolean;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (idx: number) => void;
  onDragEnd: () => void;
  onMarkStart: (idx: number) => void;
  onMarkEnd: (idx: number) => void;
}

function FichaRow({
  ficha, idx, total, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onMarkStart, onMarkEnd,
}: FichaRowProps) {
  const isStart = idx === 0;
  const isEnd = idx === total - 1;
  const pinColor = ficha.brand === "donofrio" ? "#1F3C8B" : "#EF8022";

  return (
    <div
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={e => onDragOver(e, idx)}
      onDrop={() => onDrop(idx)}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors select-none ${
        isDragOver
          ? "bg-[#EF8022]/15 dark:bg-[#EF8022]/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-600/40"
      }`}
    >
      {/* Drag handle */}
      <GripVertical className="w-3 h-3 text-gray-300 dark:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing" />

      {/* Number badge */}
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
        style={{
          background: pinColor,
          outline: isStart ? "2px solid #22c55e" : isEnd ? "2px solid #ef4444" : "none",
          outlineOffset: "1px",
        }}
      >
        {idx + 1}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-800 dark:text-gray-200 truncate leading-tight">{ficha.clienteNombre}</p>
        <p className="text-[9px] text-gray-400 truncate leading-tight">
          {ficha.distrito}{ficha.horaEntrega ? ` · ${ficha.horaEntrega}` : ""}
        </p>
      </div>

      {/* Start / End buttons */}
      <div className="flex gap-0.5 shrink-0">
        <button
          title="Mover al inicio de la ruta"
          onClick={() => onMarkStart(idx)}
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
            isStart
              ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
              : "text-gray-300 dark:text-gray-600 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
          }`}
        >
          <ChevronsUp className="w-3 h-3" />
        </button>
        <button
          title="Mover al final de la ruta"
          onClick={() => onMarkEnd(idx)}
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
            isEnd
              ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
              : "text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          }`}
        >
          <ChevronsDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function RoutesMapPage() {
  const { brand } = useBrand();

  const [vehiculosRuta, setVehiculosRuta] = useState<VehiculoRuta[]>([]);
  const [selectedVehiculoRuta, setSelectedVehiculoRuta] = useState<VehiculoRuta | null>(null);
  const [fichasPins, setFichasPins] = useState<GeocodedFicha[]>([]);
  const [fichasOrder, setFichasOrder] = useState<GeocodedFicha[]>([]);
  const [isGeocodingPins, setIsGeocodingPins] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);

  // Drag state
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Load vehicles ─────────────────────────────────────────────
  useEffect(() => {
    if (!brand) return;
    (async () => {
      try {
        const [vehiculosApi, asignacionesApi, fichasApi] = await Promise.all([
          apiRequest<any[]>(`/logistics/vehiculos?brand=${brand}`),
          apiRequest<any[]>("/logistics/asignaciones"),
          apiRequest<any[]>(`/fichas?brand=${brand}`),
        ]);
        const personalApi = await apiRequest<any[]>("/personal?rol=chofer").catch(() => []);
        const fichaMap = new Map(fichasApi.map((f: any) => [f.id, f]));
        const choferMap = new Map(personalApi.map((p: any) => [p.id, p.nombre_completo || p.nombre || ""]));

        const result: VehiculoRuta[] = vehiculosApi.map((v: any) => {
          const asigs = asignacionesApi.filter((a: any) => a.vehiculo_id === v.id);
          const fichaIds = asigs.flatMap((a: any) => (Array.isArray(a.fichas_ids) ? a.fichas_ids : []));
          const choferNombre = asigs.length > 0 ? (choferMap.get(asigs[0].chofer_id) || "—") : "—";
          const fichas: FichaPin[] = fichaIds
            .map((fid: number) => {
              const f = fichaMap.get(fid);
              if (!f) return null;
              return {
                id: f.id,
                clienteNombre: f.cliente_nombre || "",
                direccion: f.direccion || "",
                distrito: f.distrito || "",
                horaEntrega: f.hora_entrega || "",
                brand: f.brand || brand,
              } as FichaPin;
            })
            .filter(Boolean) as FichaPin[];
          return { id: v.id, placa: v.placa, modelo: v.modelo || "", chofer: choferNombre, estado: v.estado, fichas };
        });
        setVehiculosRuta(result);
      } catch { /* fail silently */ }
    })();
  }, [brand]);

  // ── Sync fichasOrder when geocoding finishes ──────────────────
  useEffect(() => {
    setFichasOrder(fichasPins);
  }, [fichasPins]);

  // ── Geocode fichas sorted by event time ──────────────────────
  const geocodeFichas = useCallback(async (fichas: FichaPin[]) => {
    if (fichas.length === 0) { setFichasPins([]); return; }
    const sorted = sortFichasByTime(fichas);
    setIsGeocodingPins(true);
    setFichasPins([]);
    setRouteCoords([]);

    const results: GeocodedFicha[] = [];
    for (const ficha of sorted) {
      const query = [ficha.direccion, ficha.distrito, "Lima, Perú"].filter(Boolean).join(", ");
      const loc = await geocodeAddress(query);
      if (loc) results.push({ ...ficha, ...loc });
      await new Promise(r => setTimeout(r, 1100));
    }
    setFichasPins(results);
    setIsGeocodingPins(false);
  }, []);

  // ── Fetch road route when order changes ──────────────────────
  useEffect(() => {
    if (isGeocodingPins || fichasOrder.length < 2) { setRouteCoords([]); return; }

    let cancelled = false;
    (async () => {
      setIsFetchingRoute(true);
      const coords = await fetchRoadRoute(fichasOrder);
      if (!cancelled) {
        setRouteCoords(coords);
        setIsFetchingRoute(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fichasOrder, isGeocodingPins]);

  // ── Vehicle selection ─────────────────────────────────────────
  const handleSelectVehiculo = (v: VehiculoRuta) => {
    if (selectedVehiculoRuta?.id === v.id) {
      setSelectedVehiculoRuta(null);
      setFichasPins([]);
      setFichasOrder([]);
      setRouteCoords([]);
    } else {
      setSelectedVehiculoRuta(v);
      geocodeFichas(v.fichas);
    }
  };

  // ── Drag & drop handlers ──────────────────────────────────────
  const handleDragStart = (idx: number) => { dragIdxRef.current = idx; };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === idx) { setDragOverIdx(null); return; }
    setFichasOrder(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(idx, 0, item);
      return arr;
    });
    dragIdxRef.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragIdxRef.current = null;
    setDragOverIdx(null);
  };

  // ── Start / End marking ───────────────────────────────────────
  const handleMarkStart = (idx: number) => {
    if (idx === 0) return;
    setFichasOrder(prev => {
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      return [item, ...arr];
    });
  };

  const handleMarkEnd = (idx: number) => {
    setFichasOrder(prev => {
      if (idx === prev.length - 1) return prev;
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      return [...arr, item];
    });
  };

  const defaultCenter: [number, number] = [-12.0464, -77.0428];

  return (
    <div className="h-[calc(100dvh-56px)] lg:h-screen flex flex-col lg:flex-row">

      {/* ── Sidebar ───────────────────────────────────── */}
      <div className="lg:w-96 bg-white dark:bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden lg:h-full max-h-[45vh] lg:max-h-none">

        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h1 className="text-xl text-gray-900 dark:text-white mb-1">Rutas de Entrega</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Selecciona un vehículo y arrastra las fichas para ordenar la ruta</p>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">
                {new Date().toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">{vehiculosRuta.length} vehículos</span>
            </div>
          </div>
        </div>

        {/* Vehicles list */}
        <div className="flex-1 overflow-y-auto p-3">
          {vehiculosRuta.length === 0 ? (
            <div className="text-center py-10">
              <Car className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400 dark:text-gray-500">Sin vehículos con asignaciones</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vehiculosRuta.map(v => {
                const isSelected = selectedVehiculoRuta?.id === v.id;
                const estadoColor = v.estado === "en-ruta"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : v.estado === "disponible"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
                const estadoLabel = v.estado === "en-ruta" ? "En Ruta" : v.estado === "disponible" ? "Disponible" : "Mantenimiento";

                return (
                  <div
                    key={v.id}
                    className={`border rounded-lg transition-all ${
                      isSelected
                        ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10"
                        : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                    }`}
                  >
                    {/* Vehicle header — clickable */}
                    <div
                      onClick={() => handleSelectVehiculo(v)}
                      className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-[#EF8022]/20" : "bg-gray-100 dark:bg-gray-600"}`}>
                            <Truck className={`w-4 h-4 ${isSelected ? "text-[#EF8022]" : "text-gray-500 dark:text-gray-400"}`} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-900 dark:text-white font-mono">{v.placa}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{v.modelo}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${estadoColor}`}>{estadoLabel}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                        <User className="w-3 h-3" />{v.chofer}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <MapPin className="w-3 h-3 text-[#EF8022]" />
                          <span className={v.fichas.length > 0 ? "text-gray-700 dark:text-gray-300" : "text-gray-400"}>
                            {v.fichas.length} {v.fichas.length === 1 ? "entrega" : "entregas"}
                          </span>
                        </div>
                        {isSelected && isGeocodingPins && (
                          <div className="flex items-center gap-1 text-[10px] text-[#EF8022]">
                            <Loader2 className="w-3 h-3 animate-spin" /> Localizando...
                          </div>
                        )}
                        {isSelected && !isGeocodingPins && fichasOrder.length > 0 && (
                          <span className="text-[10px] text-green-600 dark:text-green-400">{fichasOrder.length} listos</span>
                        )}
                      </div>
                    </div>

                    {/* Route builder — shown when geocoded */}
                    {isSelected && fichasOrder.length > 0 && (
                      <div className="border-t border-[#EF8022]/20 mx-2 mb-2">
                        {/* Column labels */}
                        <div className="flex items-center gap-1.5 px-1.5 pt-2 pb-1">
                          <span className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                            Orden de ruta · arrastra para reorganizar
                          </span>
                        </div>

                        {/* Legend for buttons */}
                        <div className="flex items-center gap-3 px-1.5 pb-1.5 text-[9px] text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <ChevronsUp className="w-2.5 h-2.5 text-green-500" /> mover al inicio
                          </span>
                          <span className="flex items-center gap-0.5">
                            <ChevronsDown className="w-2.5 h-2.5 text-red-500" /> mover al final
                          </span>
                        </div>

                        {/* Draggable list */}
                        <div className="space-y-0.5 px-0.5 pb-1">
                          {fichasOrder.map((ficha, idx) => (
                            <FichaRow
                              key={ficha.id}
                              ficha={ficha}
                              idx={idx}
                              total={fichasOrder.length}
                              isDragOver={dragOverIdx === idx}
                              onDragStart={handleDragStart}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                              onDragEnd={handleDragEnd}
                              onMarkStart={handleMarkStart}
                              onMarkEnd={handleMarkEnd}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Geocoding placeholder inside card */}
                    {isSelected && isGeocodingPins && (
                      <div className="border-t border-[#EF8022]/20 mx-2 mb-2 pt-3 pb-2 flex flex-col items-center gap-1.5">
                        <Loader2 className="w-4 h-4 text-[#EF8022] animate-spin" />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Localizando {sortFichasByTime(v.fichas).findIndex(f =>
                            !fichasOrder.some(fp => fp.id === f.id)
                          ) + 1} de {v.fichas.length}…
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Map ───────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapContainer
          center={defaultCenter}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <FitBounds pins={fichasOrder} />

          {/* Ficha pins in route order */}
          {fichasOrder.map((pin, idx) => {
            const pinType: PinType = idx === 0 ? "start" : idx === fichasOrder.length - 1 ? "end" : "normal";
            return (
              <Marker
                key={`fpin-${pin.id}`}
                position={[pin.lat, pin.lng]}
                icon={createNumberedIcon(idx + 1, pin.brand === "donofrio" ? "#1F3C8B" : "#EF8022", pinType)}
              >
                <Tooltip direction="top">{pin.clienteNombre}</Tooltip>
                <Popup>
                  <p className="font-medium text-sm mb-0.5">{pin.clienteNombre}</p>
                  <p className="text-xs text-gray-600">{pin.direccion}</p>
                  <p className="text-xs text-gray-500">{pin.distrito}</p>
                  {pin.horaEntrega && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />{pin.horaEntrega}
                    </div>
                  )}
                </Popup>
              </Marker>
            );
          })}

          {/* Road-following route */}
          {routeCoords.length > 1 && (
            <Polyline
              positions={routeCoords}
              color="#EF8022"
              weight={4}
              opacity={0.8}
            />
          )}
        </MapContainer>

        {/* Status overlay */}
        {(isGeocodingPins || isFetchingRoute) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full shadow-lg px-4 py-2 border border-gray-200 dark:border-gray-700 flex items-center gap-2 z-[1000]">
            <Loader2 className="w-4 h-4 text-[#EF8022] animate-spin" />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {isGeocodingPins ? "Localizando puntos de entrega…" : "Calculando ruta por carretera…"}
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-6 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700 z-[1000]">
          <h4 className="text-xs text-gray-900 dark:text-white mb-2">Leyenda</h4>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#1F3C8B]" />
              <span className="text-gray-600 dark:text-gray-300">D'Onofrio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EF8022]" />
              <span className="text-gray-600 dark:text-gray-300">Juguetón</span>
            </div>
            {fichasOrder.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-1 pt-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                  <span className="text-gray-600 dark:text-gray-300">Primera parada</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="text-gray-600 dark:text-gray-300">Última parada</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
