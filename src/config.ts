// All service addresses live here. Override with VITE_* variables at build time.
const env = import.meta.env;

export const CONFIG = {
  geocoder: env.VITE_GEOCODER_URL || "https://nominatim.openstreetmap.org/search",
  geocoderBackup: env.VITE_GEOCODER_BACKUP_URL || "https://photon.komoot.io/api/",
  stac: env.VITE_STAC_URL || "https://earth-search.aws.element84.com/v1/search",
  collection: "sentinel-2-l2a",
  asset: "visual",
  // {z} {x} {y} filled by Leaflet, {url} by the app.
  tiler:
    env.VITE_TILER_URL ||
    "https://titiler.xyz/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url={url}",
  // Keyless OSM tiles (fine for light use; see README for busy public sites).
  baseMap: {
    url: env.VITE_BASEMAP_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  resultLimit: 50,
  startView: [20, 0] as [number, number],
  startZoom: 2,
  searchZoom: 12,
  defaults: { days: 30, cloud: 20, opacity: 100 },
  // Re-search automatically when the map centre moves this far (km) from the last search.
  researchKm: 40,
};

export const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];
