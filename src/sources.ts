import { ageText, dateText } from "./format";
import type { Scene } from "./stac";

export type SourceId = "s2" | "modis" | "viirs" | "esri";

export interface Source {
  id: SourceId;
  name: string;
  res: string;
  blurb: string;
  kind: "stac" | "daily" | "static";
  /** Highest zoom with real detail. Beyond it tiles are just enlarged. */
  maxNative: number;
  tiles?: string;
  usesCloud: boolean;
  usesDays: boolean;
  credit: string;
}

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

export const SOURCES: Source[] = [
  {
    id: "s2", name: "Sentinel-2", res: "10 m · every ~5 days",
    blurb: "Sharpest free recent imagery, filtered by cloud.",
    kind: "stac", maxNative: 14, usesCloud: true, usesDays: true,
    credit: "Contains modified Copernicus Sentinel data",
  },
  {
    id: "modis", name: "MODIS", res: "250 m · daily",
    blurb: "Whole-world daily true colour, near real time. Coarse.",
    kind: "daily", maxNative: 9, usesCloud: false, usesDays: true,
    tiles: `${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    credit: "NASA GIBS / MODIS Terra",
  },
  {
    id: "viirs", name: "VIIRS", res: "375 m · daily",
    blurb: "Daily true colour from Suomi NPP. Slightly finer than MODIS.",
    kind: "daily", maxNative: 9, usesCloud: false, usesDays: true,
    tiles: `${GIBS}/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    credit: "NASA GIBS / VIIRS SNPP",
  },
  {
    id: "esri", name: "Esri", res: "<1 m · archive",
    blurb: "Very sharp, but a mix of dates (often 1–3 years old).",
    kind: "static", maxNative: 19, usesCloud: false, usesDays: false,
    tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri, Maxar, Earthstar Geographics",
  },
];

export const sourceById = (id: SourceId) => SOURCES.find((s) => s.id === id)!;

/** Source a scene id belongs to. Sentinel-2 ids have no prefix. */
export function sourceOfScene(id: string): SourceId {
  const p = id.split("_")[0];
  return p === "modis" || p === "viirs" || p === "esri" ? p : "s2";
}

function thumbFor(tpl: string, lat: number, lon: number, date: string): string {
  const z = 5, n = 2 ** z, rad = Math.PI / 180;
  const x = Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(lat * rad) + 1 / Math.cos(lat * rad)) / Math.PI) / 2) * n)));
  return tpl.replace("{date}", date).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

export function dailyScene(src: Source, day: string, lat: number, lon: number): Scene {
  const iso = `${day}T12:00:00Z`;
  return {
    id: `${src.id}_${day}`, datetime: iso, cloud: null, bbox: null, geometry: null,
    tiles: src.tiles!.replace("{date}", day), maxNative: src.maxNative,
    thumbnail: thumbFor(src.tiles!, lat, lon, day),
    title: dateText(iso), subtitle: `Daily composite · ${ageText(iso)}`,
  };
}

/** Daily composites need no search: one entry per day, newest first. */
export function dailyScenes(src: Source, days: number, lat: number, lon: number): Scene[] {
  const out: Scene[] = [];
  const now = Date.now();
  for (let i = 1; i <= Math.min(days, 60); i++) {
    out.push(dailyScene(src, new Date(now - i * 86_400_000).toISOString().slice(0, 10), lat, lon));
  }
  return out;
}

export function staticScenes(src: Source): Scene[] {
  return [{
    id: `${src.id}_latest`, datetime: "", cloud: null, bbox: null, geometry: null,
    tiles: src.tiles!, maxNative: src.maxNative,
    title: "Latest mosaic", subtitle: "Capture dates vary by area",
  }];
}
