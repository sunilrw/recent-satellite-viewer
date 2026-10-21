import { CONFIG } from "./config";

export interface Scene {
  id: string;
  datetime: string;
  cloud: number | null;
  bbox: [number, number, number, number] | null;
  geometry: GeoJSON.Geometry | null;
  /** Ready-to-use tile URL template for this scene. */
  tiles?: string;
  maxNative: number;
  thumbnail?: string;
  title?: string;
  subtitle?: string;
}

export async function searchScenes(
  lat: number,
  lon: number,
  days: number,
  maxCloud: number,
  signal?: AbortSignal,
  range?: { start: Date; end: Date },
): Promise<Scene[]> {
  const end = range?.end ?? new Date();
  const start = range?.start ?? new Date(end.getTime() - days * 86_400_000);
  const body = {
    collections: [CONFIG.collection],
    intersects: { type: "Point", coordinates: [lon, lat] },
    datetime: `${start.toISOString()}/${end.toISOString()}`,
    query: { "eo:cloud_cover": { lte: maxCloud } },
    sortby: [{ field: "properties.datetime", direction: "desc" }],
    limit: CONFIG.resultLimit,
  };
  const res = await fetch(CONFIG.stac, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/geo+json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Server answered ${res.status}`);
  const data = await res.json();
  return (data.features ?? []).map((f: any): Scene => {
    const visual: string | undefined = f.assets?.[CONFIG.asset]?.href;
    return {
    id: f.id,
    datetime: f.properties.datetime,
    cloud: typeof f.properties["eo:cloud_cover"] === "number" ? f.properties["eo:cloud_cover"] : null,
    bbox: f.bbox,
    geometry: f.geometry ?? null,
    tiles: visual && CONFIG.tiler.replace("{url}", encodeURIComponent(visual)),
    maxNative: 14,
    thumbnail: f.assets?.thumbnail?.href,
    };
  });
}
