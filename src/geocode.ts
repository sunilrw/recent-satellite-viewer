import { CONFIG } from "./config";

export interface Place {
  lat: number;
  lon: number;
  name: string;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Server answered ${res.status}`);
  return res.json();
}

async function nominatim(text: string): Promise<Place | null> {
  const list = await getJson(`${CONFIG.geocoder}?format=jsonv2&limit=1&q=${encodeURIComponent(text)}`);
  if (!list.length) return null;
  return { lat: parseFloat(list[0].lat), lon: parseFloat(list[0].lon), name: list[0].display_name };
}

async function photon(text: string): Promise<Place | null> {
  const data = await getJson(`${CONFIG.geocoderBackup}?limit=1&q=${encodeURIComponent(text)}`);
  const f = data.features?.[0];
  if (!f) return null;
  const p = f.properties || {};
  const name = [p.name, p.city, p.state, p.country].filter(Boolean).join(", ");
  return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name };
}

/** Main geocoder first, backup if it fails or finds nothing. */
export async function searchPlace(text: string): Promise<Place> {
  const place =
    (await nominatim(text).catch(() => null)) ?? (await photon(text).catch(() => null));
  if (!place) throw new Error("No place found, or the place search services are busy. Try again in a moment.");
  return place;
}
