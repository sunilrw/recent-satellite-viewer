export interface View {
  lat: number;
  lon: number;
  zoom: number;
  scene?: string;
}

export function encodeHash(v: View): string {
  const base = `${v.lat.toFixed(4)},${v.lon.toFixed(4)},${v.zoom}`;
  return "#" + (v.scene ? `${base},${encodeURIComponent(v.scene)}` : base);
}

export function decodeHash(hash: string): View | null {
  const parts = hash.replace(/^#/, "").split(",");
  if (parts.length < 3) return null;
  const [lat, lon, zoom] = parts.slice(0, 3).map(Number);
  if (![lat, lon, zoom].every(Number.isFinite)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || zoom < 0 || zoom > 22) return null;
  const scene = parts[3] ? decodeURIComponent(parts.slice(3).join(",")) : undefined;
  return { lat, lon, zoom, scene };
}
