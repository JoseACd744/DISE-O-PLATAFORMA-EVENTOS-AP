// Google Maps API Configuration
export const GOOGLE_MAPS_CONFIG = {
  apiKey: "AIzaSyC2D1kIqOqR3bRMGF8r16L9zZUztHjB3Bk",
  libraries: ["places", "geometry", "routes"] as const,
  id: "google-map-script",
};

// Map default settings
export const MAP_DEFAULTS = {
  center: {
    lat: -12.0464,
    lng: -77.0428,
  },
  zoom: 12,
  options: {
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControl: true,
    styles: [], // Add custom map styles here if needed
  },
};

// Warehouse/Distribution Center location
export const WAREHOUSE_LOCATION = {
  lat: -12.0464,
  lng: -77.0428,
  name: "Centro de Distribución D'Onofrio",
  address: "Lima, Perú",
};