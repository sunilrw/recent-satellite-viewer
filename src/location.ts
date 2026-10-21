import { decodeHash } from "./hash";
import type { GoTarget } from "./ctx";
import { sourceOfScene } from "./sources";

const num = (s: string) => parseFloat(s);
const ok = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/**
 * Understands what people paste when someone "sends a location":
 * our own links, plain "lat, lon", geo: URIs, Google Maps and OpenStreetMap links.
 */
export function parseLocation(input: string): GoTarget | null {
  const t = input.trim();
  if (!t) return null;
  let m: RegExpMatchArray | null;

  // Plain coordinates: "-1.3863, 36.8737"
  if ((m = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/))) {
    const lat = num(m[1]), lon = num(m[2]);
    if (ok(lat, lon)) return { lat, lon, name: `${lat}, ${lon}`, zoom: 15 };
  }
  // geo:lat,lon?z=15
  if ((m = t.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[;?].*?z=(\d+))?/i))) {
    const lat = num(m[1]), lon = num(m[2]);
    if (ok(lat, lon)) return { lat, lon, name: `${lat}, ${lon}`, zoom: m[3] ? +m[3] : 15 };
  }
  // Our own link (or just its #hash)
  const hashIdx = t.indexOf("#");
  if (hashIdx >= 0 && !/[?&](ll|q|mlat)=|\/@|#map=/.test(t)) {
    const v = decodeHash(t.slice(hashIdx));
    if (v) return { lat: v.lat, lon: v.lon, zoom: Math.round(v.zoom), name: `${v.lat.toFixed(4)}, ${v.lon.toFixed(4)}`, source: v.scene ? sourceOfScene(v.scene) : undefined };
  }
  // Google Maps: .../@lat,lon,15z  or !3dlat!4dlon  or ?q=lat,lon / ?ll=lat,lon
  if ((m = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/))) {
    const lat = num(m[1]), lon = num(m[2]);
    if (ok(lat, lon)) return { lat, lon, name: `${lat}, ${lon}`, zoom: 16 };
  }
  if ((m = t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/))) {
    const lat = num(m[1]), lon = num(m[2]);
    if (ok(lat, lon)) return { lat, lon, name: `${lat}, ${lon}`, zoom: m[3] ? Math.round(+m[3]) : 15 };
  }
  if ((m = t.match(/[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i))) {
    const lat = num(m[1]), lon = num(m[2]);
    if (ok(lat, lon)) return { lat, lon, name: `${lat}, ${lon}`, zoom: 16 };
  }
  // OpenStreetMap: #map=15/lat/lon  or ?mlat=..&mlon=..
  if ((m = t.match(/#map=(\d+)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/))) {
    const lat = num(m[2]), lon = num(m[3]);
    if (ok(lat, lon)) return { lat, lon, name: `${lat}, ${lon}`, zoom: +m[1] };
  }
  if ((m = t.match(/mlat=(-?\d+(?:\.\d+)?)&(?:amp;)?mlon=(-?\d+(?:\.\d+)?)/))) {
    const lat = num(m[1]), lon = num(m[2]);
    if (ok(lat, lon)) return { lat, lon, name: `${lat}, ${lon}`, zoom: 16 };
  }
  return null;
}

export interface Where { lat: number; lon: number; zoom: number }

export const links = {
  google: (w: Where) => `https://www.google.com/maps/@${w.lat.toFixed(6)},${w.lon.toFixed(6)},${Math.round(w.zoom)}z`,
  osm: (w: Where) => `https://www.openstreetmap.org/#map=${Math.round(w.zoom)}/${w.lat.toFixed(5)}/${w.lon.toFixed(5)}`,
  geo: (w: Where) => `geo:${w.lat.toFixed(6)},${w.lon.toFixed(6)}?z=${Math.round(w.zoom)}`,
  coords: (w: Where) => `${w.lat.toFixed(6)}, ${w.lon.toFixed(6)}`,
};
