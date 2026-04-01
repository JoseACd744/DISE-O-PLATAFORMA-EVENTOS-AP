import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { GoogleMap, useJsApiLoader, OverlayViewF, OverlayView, Polyline, InfoWindow } from "@react-google-maps/api";
import {
  MapPin, Clock, Package, Navigation, Calendar, RefreshCw, TrendingUp,
  Truck, User, Radio, Eye, EyeOff, Layers, Shield
} from "lucide-react";
import { GOOGLE_MAPS_CONFIG, WAREHOUSE_LOCATION } from "../../config/maps";

const mapContainerStyle = { width: "100%", height: "100%" };

const center = { lat: -12.0464, lng: -77.0428 };

// ── Types ────────────────────────────────────────────────────────

interface Delivery {
  id: string;
  clientName: string;
  address: string;
  lat: number;
  lng: number;
  timeWindow: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in-progress" | "completed";
  products: number;
  estimatedTime: string;
  brand: "donofrio" | "jugueton";
}

interface VehicleGPS {
  id: number;
  placa: string;
  modelo: string;
  chofer: string;
  lat: number;
  lng: number;
  speed: number; // km/h
  heading: number; // degrees
  lastUpdate: string;
  status: "moving" | "stopped" | "idle";
  brands: ("donofrio" | "jugueton")[];
}

// ── Mock Data ────────────────────────────────────────────────────

const mockDeliveries: Delivery[] = [
  {
    id: "1", clientName: "Supermercado Metro - San Isidro", address: "Av. Javier Prado Este 123",
    lat: -12.0897, lng: -77.0282, timeWindow: "08:00 - 10:00", priority: "high",
    status: "completed", products: 45, estimatedTime: "25 min", brand: "donofrio",
  },
  {
    id: "2", clientName: "Bodega La Esperanza", address: "Jr. Los Pinos 456, Miraflores",
    lat: -12.1196, lng: -77.0365, timeWindow: "10:00 - 12:00", priority: "high",
    status: "in-progress", products: 32, estimatedTime: "18 min", brand: "donofrio",
  },
  {
    id: "3", clientName: "Minimarket San Pedro", address: "Av. La Marina 789, San Miguel",
    lat: -12.0772, lng: -77.0866, timeWindow: "11:00 - 13:00", priority: "medium",
    status: "pending", products: 28, estimatedTime: "22 min", brand: "jugueton",
  },
  {
    id: "4", clientName: "Tienda Don José", address: "Calle Los Sauces 234, Surco",
    lat: -12.1461, lng: -76.9932, timeWindow: "13:00 - 15:00", priority: "medium",
    status: "pending", products: 41, estimatedTime: "30 min", brand: "donofrio",
  },
  {
    id: "5", clientName: "Comercial Santa Rosa", address: "Av. Universitaria 567, Los Olivos",
    lat: -11.9854, lng: -77.0638, timeWindow: "14:00 - 16:00", priority: "low",
    status: "pending", products: 19, estimatedTime: "15 min", brand: "jugueton",
  },
];

const mockVehicleGPS: VehicleGPS[] = [
  {
    id: 1, placa: "ABC-123", modelo: "Hilux 2023", chofer: "Carlos Mendoza",
    lat: -12.105, lng: -77.032, speed: 35, heading: 180,
    lastUpdate: "hace 10 seg", status: "moving", brands: ["donofrio", "jugueton"],
  },
  {
    id: 3, placa: "GHI-789", modelo: "Dyna 2022", chofer: "Eduardo Silva",
    lat: -12.055, lng: -77.075, speed: 0, heading: 90,
    lastUpdate: "hace 45 seg", status: "stopped", brands: ["donofrio"],
  },
];

// ── Helpers ──────────────────────────────────────────────────────

function getBrandColor(brand: "donofrio" | "jugueton") {
  return brand === "donofrio" ? "#1F3C8B" : "#EF8022";
}

function BrandBadge({ brand, size = "sm" }: { brand: "donofrio" | "jugueton"; size?: "xs" | "sm" }) {
  const isXs = size === "xs";
  return brand === "donofrio"
    ? <span className={`inline-flex items-center ${isXs ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} rounded bg-[#1F3C8B]/15 text-[#1F3C8B] dark:bg-[#1F3C8B]/25 dark:text-blue-400`}>D'Onofrio</span>
    : <span className={`inline-flex items-center ${isXs ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} rounded bg-[#EF8022]/15 text-[#EF8022] dark:bg-[#EF8022]/25`}>Juguetón</span>;
}

// ── Main Component ───────────────────────────────────────────────

export function RoutesMapPage() {
  const location = useLocation();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const [routePath, setRoutePath] = useState<google.maps.LatLngLiteral[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [showGPS, setShowGPS] = useState(true);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [vehiclePositions, setVehiclePositions] = useState<VehicleGPS[]>(mockVehicleGPS);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleGPS | null>(null);
  const [brandFilter, setBrandFilter] = useState<"all" | "donofrio" | "jugueton">("all");
  const [sidebarTab, setSidebarTab] = useState<"entregas" | "tracking">("entregas");
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_CONFIG.id,
    googleMapsApiKey: GOOGLE_MAPS_CONFIG.apiKey,
    libraries: GOOGLE_MAPS_CONFIG.libraries as any,
  });

  // Auto-select vehicle when navigating from LogisticsPage
  useEffect(() => {
    const state = location.state as { vehiculoPlaca?: string } | null;
    if (!state?.vehiculoPlaca || !isLoaded) return;
    const vehicle = vehiclePositions.find(v => v.placa === state.vehiculoPlaca);
    if (vehicle) {
      setSidebarTab("tracking");
      setSelectedVehicle(vehicle);
      if (mapRef.current) {
        mapRef.current.panTo({ lat: vehicle.lat, lng: vehicle.lng });
        mapRef.current.setZoom(15);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, location.state]);

  // Filter deliveries by brand
  const filteredDeliveries = brandFilter === "all"
    ? mockDeliveries
    : mockDeliveries.filter(d => d.brand === brandFilter);

  // ── GPS Simulation: animate vehicle positions ──────────────────
  useEffect(() => {
    if (!showGPS) return;
    const interval = setInterval(() => {
      setVehiclePositions(prev => prev.map(v => {
        if (v.status !== "moving") return v;
        // Simulate small movement
        const jitterLat = (Math.random() - 0.5) * 0.001;
        const jitterLng = (Math.random() - 0.5) * 0.001;
        const newSpeed = Math.max(0, v.speed + (Math.random() - 0.5) * 10);
        return {
          ...v,
          lat: v.lat + jitterLat,
          lng: v.lng + jitterLng,
          speed: Math.round(newSpeed),
          heading: (v.heading + (Math.random() - 0.5) * 30) % 360,
          lastUpdate: "hace " + Math.floor(Math.random() * 30) + " seg",
        };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [showGPS]);

  // ── Route Calculation ──────────────────────────────────────────
  const calculateRoute = useCallback(async () => {
    if (!isLoaded) return;
    setIsCalculatingRoute(true);
    try {
      const waypoints = [
        { location: { latLng: { latitude: WAREHOUSE_LOCATION.lat, longitude: WAREHOUSE_LOCATION.lng } } },
        ...filteredDeliveries.map(d => ({ location: { latLng: { latitude: d.lat, longitude: d.lng } } })),
      ];
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_CONFIG.apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs",
        },
        body: JSON.stringify({
          origin: waypoints[0],
          destination: waypoints[waypoints.length - 1],
          intermediates: waypoints.slice(1, -1),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          computeAlternativeRoutes: false,
          routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: false },
          languageCode: "es-PE",
          units: "METRIC",
        }),
      });
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const path = decodePolyline(route.polyline.encodedPolyline);
        setRoutePath(path);
        const distanceKm = (route.distanceMeters / 1000).toFixed(1);
        const durationMin = Math.round(parseInt(route.duration.replace("s", "")) / 60);
        setRouteInfo({ distance: `${distanceKm} km`, duration: `${durationMin} min` });
      }
    } catch (error) {
      console.error("Error calculating route:", error);
    } finally {
      setIsCalculatingRoute(false);
    }
  }, [isLoaded, filteredDeliveries]);

  const decodePolyline = (encoded: string): google.maps.LatLngLiteral[] => {
    const poly: google.maps.LatLngLiteral[] = [];
    let index = 0; const len = encoded.length; let lat = 0; let lng = 0;
    while (index < len) {
      let b: number; let shift = 0; let result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += result & 1 ? ~(result >> 1) : result >> 1;
      poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return poly;
  };

  useEffect(() => {
    if (isLoaded && showRoute) calculateRoute();
  }, [isLoaded, calculateRoute, showRoute]);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    const state = (window.history.state?.usr ?? {}) as { vehiculoPlaca?: string };
    if (state.vehiculoPlaca) {
      const vehicle = mockVehicleGPS.find(v => v.placa === state.vehiculoPlaca);
      if (vehicle) {
        map.panTo({ lat: vehicle.lat, lng: vehicle.lng });
        map.setZoom(15);
        return;
      }
    }
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(WAREHOUSE_LOCATION);
    mockDeliveries.forEach(d => bounds.extend({ lat: d.lat, lng: d.lng }));
    map.fitBounds(bounds);
  }, []);

  const getMarkerColor = (status: string) => {
    switch (status) {
      case "completed": return "#16a34a";
      case "in-progress": return "#2563eb";
      default: return "#f59e0b";
    }
  };
  const getPriorityBadge = (priority: string) => {
    const c: Record<string, string> = { high: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400", medium: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", low: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" };
    return c[priority] || c.medium;
  };
  const getStatusBadge = (status: string) => {
    const c: Record<string, { bg: string; text: string; label: string }> = {
      completed: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Completado" },
      "in-progress": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", label: "En Ruta" },
      pending: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Pendiente" },
    };
    return c[status] || c.pending;
  };

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#EF8022] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-56px)] lg:h-screen flex flex-col lg:flex-row">
      {/* ── Sidebar ───────────────────────────────────── */}
      <div className="lg:w-96 bg-white dark:bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden lg:h-full max-h-[45vh] lg:max-h-none">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl text-gray-900 dark:text-white mb-1">Rutas de Entrega</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Optimización diaria con seguimiento GPS</p>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">4 Mar 2026</span></div>
            <div className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">{filteredDeliveries.length} entregas</span></div>
          </div>
        </div>

        {/* Brand Filter */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1.5">
            {(["all", "donofrio", "jugueton"] as const).map(f => (
              <button key={f} onClick={() => setBrandFilter(f)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${brandFilter === f
                  ? f === "donofrio" ? "bg-[#1F3C8B] text-white" : f === "jugueton" ? "bg-[#EF8022] text-white" : "bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                {f === "all" ? "Todas" : f === "donofrio" ? "D'Onofrio" : "Juguetón"}
              </button>
            ))}
          </div>
        </div>

        {/* Route Info */}
        {routeInfo && showRoute && (
          <div className="p-3 bg-[#1F3C8B]/5 dark:bg-[#1F3C8B]/10 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" />
              <h3 className="text-xs text-gray-900 dark:text-white">Ruta Optimizada</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Distancia</p>
                <p className="text-sm text-[#1F3C8B] dark:text-blue-400">{routeInfo.distance}</p>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Tiempo</p>
                <p className="text-sm text-[#EF8022]">{routeInfo.duration}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2">
          <div className="text-center"><p className="text-[10px] text-gray-500 dark:text-gray-400">Pendientes</p><p className="text-lg text-amber-600 dark:text-amber-400">{filteredDeliveries.filter(d => d.status === "pending").length}</p></div>
          <div className="text-center"><p className="text-[10px] text-gray-500 dark:text-gray-400">En Ruta</p><p className="text-lg text-blue-600 dark:text-blue-400">{filteredDeliveries.filter(d => d.status === "in-progress").length}</p></div>
          <div className="text-center"><p className="text-[10px] text-gray-500 dark:text-gray-400">Completadas</p><p className="text-lg text-green-600 dark:text-green-400">{filteredDeliveries.filter(d => d.status === "completed").length}</p></div>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setSidebarTab("entregas")}
            className={`flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5 transition-colors ${sidebarTab === "entregas" ? "text-[#EF8022] border-b-2 border-[#EF8022]" : "text-gray-500 dark:text-gray-400"}`}>
            <Package className="w-3.5 h-3.5" /> Entregas
          </button>
          <button onClick={() => setSidebarTab("tracking")}
            className={`flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5 transition-colors ${sidebarTab === "tracking" ? "text-[#EF8022] border-b-2 border-[#EF8022]" : "text-gray-500 dark:text-gray-400"}`}>
            <Radio className="w-3.5 h-3.5" /> GPS en Vivo
            {showGPS && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
          </button>
        </div>

        {/* Controls */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            onClick={() => { setShowRoute(!showRoute); if (!showRoute && routePath.length === 0) calculateRoute(); }}
            disabled={isCalculatingRoute}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-50 ${showRoute ? "bg-[#EF8022] text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
            {isCalculatingRoute ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Calculando...</> : <><Navigation className="w-3.5 h-3.5" /> {showRoute ? "Ocultar Ruta" : "Ver Ruta"}</>}
          </button>
          <button
            onClick={() => setShowGPS(!showGPS)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors ${showGPS ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
            <Radio className="w-3.5 h-3.5" /> GPS
          </button>
        </div>

        {/* ── ENTREGAS LIST ──────────────────────────────── */}
        {sidebarTab === "entregas" && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {/* Warehouse */}
              <div className="bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20 border border-[#1F3C8B]/30 rounded-lg p-3">
                <div className="flex items-start gap-2.5">
                  <div className="bg-[#1F3C8B] p-1.5 rounded-lg mt-0.5"><Package className="w-4 h-4 text-white" /></div>
                  <div><p className="text-xs text-gray-900 dark:text-white">Punto de Salida</p><p className="text-[10px] text-gray-500 dark:text-gray-400">{WAREHOUSE_LOCATION.name}</p></div>
                </div>
              </div>

              {filteredDeliveries.map((delivery, index) => {
                const statusConfig = getStatusBadge(delivery.status);
                return (
                  <div key={delivery.id}
                    onClick={() => setSelectedDelivery(delivery)}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${selectedDelivery?.id === delivery.id ? "border-[#EF8022] bg-[#EF8022]/10 dark:bg-[#EF8022]/20" : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"}`}>
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs shrink-0" style={{ backgroundColor: getMarkerColor(delivery.status) }}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-xs text-gray-900 dark:text-white truncate">{delivery.clientName}</p>
                          <BrandBadge brand={delivery.brand} size="xs" />
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 truncate">{delivery.address}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>{statusConfig.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${getPriorityBadge(delivery.priority)}`}>
                            {delivery.priority === "high" ? "Alta" : delivery.priority === "medium" ? "Media" : "Baja"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{delivery.timeWindow}</div>
                          <div className="flex items-center gap-1"><Package className="w-3 h-3" />{delivery.products} prod.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── GPS TRACKING LIST ──────────────────────────── */}
        {sidebarTab === "tracking" && (
          <div className="flex-1 overflow-y-auto p-3">
            {/* Shared route info */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-2.5 mb-3 flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-purple-700 dark:text-purple-400">
                Vehículos pueden llevar pedidos de ambas marcas en la misma ruta.
              </p>
            </div>

            <div className="space-y-2">
              {vehiclePositions.map(vehicle => (
                <div key={vehicle.id}
                  onClick={() => {
                    setSelectedVehicle(vehicle);
                    if (mapRef.current) mapRef.current.panTo({ lat: vehicle.lat, lng: vehicle.lng });
                  }}
                  className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${selectedVehicle?.id === vehicle.id ? "border-[#EF8022] bg-[#EF8022]/5 dark:bg-[#EF8022]/10" : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${vehicle.status === "moving" ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-700"}`}>
                        <Truck className={`w-4 h-4 ${vehicle.status === "moving" ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-900 dark:text-white font-mono">{vehicle.placa}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{vehicle.modelo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {vehicle.status === "moving" && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${vehicle.status === "moving" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
                        {vehicle.status === "moving" ? "En movimiento" : vehicle.status === "stopped" ? "Detenido" : "Inactivo"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <p className="text-gray-400">Chofer</p>
                      <div className="flex items-center gap-1"><User className="w-3 h-3 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">{vehicle.chofer}</span></div>
                    </div>
                    <div>
                      <p className="text-gray-400">Velocidad</p>
                      <p className="text-gray-700 dark:text-gray-300">{vehicle.speed} km/h</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Actualizado</p>
                      <p className="text-gray-700 dark:text-gray-300">{vehicle.lastUpdate}</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-600 flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">Marcas:</span>
                    {vehicle.brands.map(b => <BrandBadge key={b} brand={b} size="xs" />)}
                  </div>
                </div>
              ))}

              {vehiclePositions.length === 0 && (
                <div className="text-center py-8">
                  <Radio className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No hay vehículos con GPS activo</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Map ───────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={12}
          onLoad={onLoad}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false, zoomControl: true }}
        >
          {/* Warehouse Marker */}
          <OverlayViewF position={WAREHOUSE_LOCATION} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <div className="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
              <div className="w-10 h-10 rounded-full bg-[#1F3C8B] border-3 border-[#EF8022] flex items-center justify-center shadow-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full bg-[#1F3C8B] text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                Centro de Distribución
              </div>
            </div>
          </OverlayViewF>

          {/* Delivery Markers with brand indicator */}
          {filteredDeliveries.map((delivery, index) => (
            <OverlayViewF key={delivery.id} position={{ lat: delivery.lat, lng: delivery.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div className="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer group" onClick={() => setSelectedDelivery(delivery)}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs border-2 shadow-lg transition-transform group-hover:scale-110"
                  style={{ backgroundColor: getMarkerColor(delivery.status), borderColor: getBrandColor(delivery.brand) }}>
                  {index + 1}
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md max-w-[160px] truncate">
                  {delivery.clientName}
                </div>
                {/* Brand dot indicator */}
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: getBrandColor(delivery.brand) }} />
              </div>
            </OverlayViewF>
          ))}

          {/* ── GPS Vehicle Markers ──────────────────────── */}
          {showGPS && vehiclePositions.map(vehicle => (
            <OverlayViewF key={`gps-${vehicle.id}`} position={{ lat: vehicle.lat, lng: vehicle.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div className="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                onClick={() => setSelectedVehicle(vehicle)}>
                {/* Vehicle icon with pulse */}
                <div className="relative">
                  {vehicle.status === "moving" && (
                    <div className="absolute inset-0 w-12 h-12 -m-1 rounded-full bg-green-500/30 animate-ping" />
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 ${vehicle.status === "moving" ? "bg-green-500 border-green-300" : "bg-gray-500 border-gray-300"}`}
                    style={{ transform: `rotate(${vehicle.heading}deg)` }}>
                    <Truck className="w-5 h-5 text-white" style={{ transform: `rotate(-${vehicle.heading}deg)` }} />
                  </div>
                </div>
                {/* Tooltip */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-md whitespace-nowrap z-10">
                  <p>{vehicle.placa} &middot; {vehicle.chofer}</p>
                  <p className="text-gray-300">{vehicle.speed} km/h &middot; {vehicle.lastUpdate}</p>
                </div>
              </div>
            </OverlayViewF>
          ))}

          {/* Route Polyline */}
          {showRoute && routePath.length > 0 && (
            <Polyline
              path={routePath}
              options={{ strokeColor: "#EF8022", strokeOpacity: 0.8, strokeWeight: 5, geodesic: true }}
            />
          )}

          {/* Info Window for selected delivery */}
          {selectedDelivery && (
            <InfoWindow
              position={{ lat: selectedDelivery.lat, lng: selectedDelivery.lng }}
              onCloseClick={() => setSelectedDelivery(null)}
            >
              <div className="p-2 max-w-xs">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm text-gray-900">{selectedDelivery.clientName}</h3>
                  <BrandBadge brand={selectedDelivery.brand} size="xs" />
                </div>
                <p className="text-xs text-gray-600 mb-2">{selectedDelivery.address}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1 text-gray-600"><Clock className="w-3 h-3" /><span>Ventana: {selectedDelivery.timeWindow}</span></div>
                  <div className="flex items-center gap-1 text-gray-600"><Package className="w-3 h-3" /><span>{selectedDelivery.products} productos</span></div>
                  <div className="flex items-center gap-1 text-gray-600"><Navigation className="w-3 h-3" /><span>Estimado: {selectedDelivery.estimatedTime}</span></div>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Map Legend */}
        <div className="absolute bottom-6 left-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <h4 className="text-xs text-gray-900 dark:text-white mb-2">Leyenda</h4>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-600"></div><span className="text-gray-600 dark:text-gray-300">Completado</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-gray-600 dark:text-gray-300">En Ruta</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-600"></div><span className="text-gray-600 dark:text-gray-300">Pendiente</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#1F3C8B]"></div><span className="text-gray-600 dark:text-gray-300">Centro Dist.</span></div>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1 pt-1"></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500"></div><span className="text-gray-600 dark:text-gray-300">Vehículo GPS</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-[#1F3C8B]"></div><span className="text-gray-600 dark:text-gray-300">D'Onofrio</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-[#EF8022]"></div><span className="text-gray-600 dark:text-gray-300">Juguetón</span></div>
          </div>
        </div>

        {/* GPS Status Indicator */}
        {showGPS && (
          <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 border border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-700 dark:text-gray-300">GPS en vivo</span>
            <span className="text-xs text-gray-400">{vehiclePositions.length} vehículos</span>
          </div>
        )}
      </div>
    </div>
  );
}
