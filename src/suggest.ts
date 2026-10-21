import { CONFIG } from "./config";
import type { GoTarget } from "./ctx";

interface Suggestion { label: string; sub: string; target: GoTarget }

/** Parses "lat, lon" typed or pasted by the user. */
export function parseCoords(text: string): GoTarget | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, name: `${lat}, ${lon}`, zoom: 15 };
}

function toSuggestion(f: any): Suggestion | null {
  const p = f.properties ?? {};
  const [lon, lat] = f.geometry?.coordinates ?? [];
  if (typeof lat !== "number") return null;
  const name: string = p.name || [p.street, p.housenumber].filter(Boolean).join(" ") || p.city || "";
  if (!name) return null;
  const sub = [p.district, p.city !== name ? p.city : null, p.state, p.country].filter(Boolean).join(", ");
  const target: GoTarget = { lat, lon, name: [name, sub].filter(Boolean).join(", ") };
  if (Array.isArray(p.extent) && p.extent.length === 4) {
    const [w, n, e, s] = p.extent as number[]; // Photon: minLon, maxLat, maxLon, minLat
    if (e - w > 0.0005) target.bounds = [s, w, n, e];
  }
  if (!target.bounds) target.zoom = p.housenumber ? 18 : 16;
  return { label: name, sub, target };
}

export function initSuggest(
  input: HTMLInputElement,
  list: HTMLUListElement,
  getCenter: () => { lat: number; lon: number; zoom: number },
  onPick: (t: GoTarget) => void,
) {
  let items: Suggestion[] = [];
  let active = -1;
  let timer: number | undefined;
  let ctl: AbortController | null = null;

  const close = () => { list.hidden = true; active = -1; };
  const paint = () => {
    list.textContent = "";
    items.forEach((s, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.classList.toggle("active", i === active);
      const a = document.createElement("strong"); a.textContent = s.label;
      const b = document.createElement("span"); b.textContent = s.sub;
      li.append(a, b);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
      list.append(li);
    });
    list.hidden = !items.length;
  };
  const pick = (i: number) => {
    const s = items[i];
    if (!s) return;
    input.value = s.label;
    close();
    onPick(s.target);
  };

  async function fetchSuggestions(q: string) {
    ctl?.abort();
    ctl = new AbortController();
    const c = getCenter();
    // Only bias to the map when zoomed in close: it lets "pizza" find the one next door,
    // but at wide zoom it would drown a typo-corrected far-away match.
    const bias = c.zoom >= 11 ? `&lat=${c.lat.toFixed(3)}&lon=${c.lon.toFixed(3)}&location_bias_scale=0.2` : "";
    try {
      const res = await fetch(`${CONFIG.geocoderBackup}?limit=6&lang=en&q=${encodeURIComponent(q)}${bias}`, { signal: ctl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const seen = new Set<string>();
      items = (data.features ?? []).map(toSuggestion).filter((s: Suggestion | null): s is Suggestion => {
        if (!s) return false;
        const k = `${s.label}|${s.sub}`;
        return seen.has(k) ? false : (seen.add(k), true);
      });
      active = -1;
      paint();
    } catch (e) {
      if ((e as Error).name !== "AbortError") close();
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3 || parseCoords(q)) { items = []; close(); return; }
    timer = window.setTimeout(() => fetchSuggestions(q), 250);
  });
  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { active = (active + 1) % items.length; paint(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + items.length) % items.length; paint(); e.preventDefault(); }
    else if (e.key === "Escape") close();
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); }
  });
  input.addEventListener("blur", () => setTimeout(close, 120));

  return {
    /** Best guess for what was typed — Photon already forgives typos. */
    first(): GoTarget | null { return items[0]?.target ?? null; },
    close,
  };
}
