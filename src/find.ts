import L from "leaflet";
import { OVERPASS } from "./config";
import type { Ctx } from "./ctx";
import { el } from "./ctx";

interface Cat {
  id: string; emoji: string; label: string; color: string; line?: boolean;
  /** Overpass selectors; {b} becomes the bounding box. */
  q: string[];
  match: (t: Record<string, string>) => boolean;
}

const CATS: Cat[] = [
  { id: "houses", emoji: "🏠", label: "Houses & buildings", color: "#f59e0b", q: ['way["building"]({b})'], match: (t) => !!t.building },
  { id: "water", emoji: "💧", label: "Lakes & ponds", color: "#38bdf8", q: ['way["natural"="water"]({b})', 'way["landuse"="reservoir"]({b})'], match: (t) => t.natural === "water" || t.landuse === "reservoir" },
  { id: "rivers", emoji: "🏞️", label: "Rivers & canals", color: "#0ea5e9", line: true, q: ['way["waterway"~"^(river|canal)$"]({b})'], match: (t) => /^(river|canal)$/.test(t.waterway || "") },
  { id: "pools", emoji: "🏊", label: "Swimming pools", color: "#22d3ee", q: ['way["leisure"="swimming_pool"]({b})'], match: (t) => t.leisure === "swimming_pool" },
  { id: "parking", emoji: "🚗", label: "Parking lots (cars)", color: "#f43f5e", q: ['way["amenity"="parking"]({b})'], match: (t) => t.amenity === "parking" },
  { id: "roads", emoji: "🛣️", label: "Main roads", color: "#e5e7eb", line: true, q: ['way["highway"~"^(motorway|trunk|primary|secondary)$"]({b})'], match: (t) => /^(motorway|trunk|primary|secondary)$/.test(t.highway || "") },
  { id: "forest", emoji: "🌲", label: "Forest & woods", color: "#22c55e", q: ['way["natural"="wood"]({b})', 'way["landuse"="forest"]({b})'], match: (t) => t.natural === "wood" || t.landuse === "forest" },
  { id: "farm", emoji: "🌾", label: "Farmland & orchards", color: "#a3e635", q: ['way["landuse"~"^(farmland|orchard|vineyard)$"]({b})'], match: (t) => /^(farmland|orchard|vineyard)$/.test(t.landuse || "") },
  { id: "sport", emoji: "⚽", label: "Pitches & stadiums", color: "#c084fc", q: ['way["leisure"~"^(pitch|stadium|golf_course)$"]({b})'], match: (t) => /^(pitch|stadium|golf_course)$/.test(t.leisure || "") },
  { id: "air", emoji: "✈️", label: "Airports & runways", color: "#94a3b8", q: ['way["aeroway"~"^(aerodrome|runway|apron)$"]({b})'], match: (t) => !!t.aeroway },
  { id: "energy", emoji: "☀️", label: "Solar & wind", color: "#fde047", q: ['way["generator:source"="solar"]({b})', 'node["generator:source"="wind"]({b})'], match: (t) => /^(solar|wind)$/.test(t["generator:source"] || "") },
  { id: "zoo", emoji: "🦒", label: "Zoos & wildlife parks", color: "#fb923c", q: ['way["tourism"="zoo"]({b})', 'node["tourism"="zoo"]({b})', 'way["zoo"]({b})'], match: (t) => t.tourism === "zoo" || !!t.zoo },
];

const MAX = 4000;

export function initFind(ctx: Ctx) {
  const { map } = ctx;
  const chips = el("featureChips"), status = el("featureStatus"), legend = el("featureLegend");
  const btn = el<HTMLButtonElement>("findFeatures"), clear = el<HTMLButtonElement>("clearFeatures");
  const renderer = L.canvas({ padding: 0.3 });
  const group = L.layerGroup().addTo(map);
  const on = new Set<string>(["houses"]);
  let ctl: AbortController | null = null;

  for (const c of CATS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip" + (on.has(c.id) ? " on" : "");
    b.innerHTML = `<span>${c.emoji}</span> `;
    b.append(c.label);
    b.addEventListener("click", () => { on.has(c.id) ? on.delete(c.id) : on.add(c.id); b.classList.toggle("on", on.has(c.id)); });
    chips.append(b);
  }

  const say = (t: string, warn = false) => { status.textContent = t; status.classList.toggle("warn", warn); };

  async function run() {
    if (!on.size) return say("Pick at least one thing to find.", true);
    if (map.getZoom() < 13) {
      say("Zoom in closer first (zoom 13 or more) so the search stays small.", true);
      return;
    }
    const b = map.getBounds();
    const bbox = `${b.getSouth().toFixed(5)},${b.getWest().toFixed(5)},${b.getNorth().toFixed(5)},${b.getEast().toFixed(5)}`;
    const cats = CATS.filter((c) => on.has(c.id));
    const body = `[out:json][timeout:25];(${cats.flatMap((c) => c.q).map((q) => q.replace("{b}", bbox) + ";").join("")});out geom ${MAX};`;

    ctl?.abort();
    const my = (ctl = new AbortController());
    btn.disabled = true; say("Searching map data…");
    let data: any = null, lastErr = "";
    const stop = new AbortController();
    my.signal.addEventListener("abort", () => stop.abort());
    const giveUp = setTimeout(() => stop.abort(), 25000);
    const form = new URLSearchParams({ data: body });

    // Hedged requests: ask the next mirror if the first hasn't answered in 2s.
    // The first good answer wins and the rest are cancelled.
    const ask = async (url: string, delay: number) => {
      await new Promise((r) => setTimeout(r, delay));
      if (stop.signal.aborted) throw new Error("cancelled");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: stop.signal,
      });
      if (!res.ok) throw new Error(res.status === 502 || res.status === 429 || res.status === 504 ? "free server at capacity" : `server ${res.status}`);
      const json = await res.json().catch(() => null);
      if (!json) throw new Error("bad reply");
      if (json.remark && !json.elements?.length && /error|timed out|memory/i.test(json.remark)) throw new Error("server overloaded");
      return json;
    };
    const tryAll = (offset: number) =>
      Promise.any(OVERPASS.map((u, i) => ask(u, offset + i * 2000)));
    try {
      try { data = await tryAll(0); }
      catch (e) {
        if (stop.signal.aborted) throw e;
        say("Servers are busy, retrying…");
        data = await tryAll(2500);
      }
    } catch (e) {
      const errs = (e as AggregateError).errors as Error[] | undefined;
      lastErr = errs?.find((x) => /capacity|overloaded/.test(x.message))?.message ?? (stop.signal.aborted ? "timed out" : errs?.[0]?.message ?? "no answer");
    } finally {
      clearTimeout(giveUp);
      stop.abort();
    }
    btn.disabled = false;
    if (ctl !== my) return;
    if (!data) return say(`Could not get map data (${lastErr}). The free OpenStreetMap servers are often busy — try again in a minute.`, true);

    group.clearLayers();
    const counts = new Map<string, number>();
    for (const el of data.elements ?? []) {
      const tags = el.tags ?? {};
      const cat = cats.find((c) => c.match(tags));
      if (!cat) continue;
      counts.set(cat.id, (counts.get(cat.id) ?? 0) + 1);
      if (el.type === "node") {
        group.addLayer(L.circleMarker([el.lat, el.lon], { renderer, radius: 5, color: "#fff", weight: 1.5, fillColor: cat.color, fillOpacity: 1 }));
      } else if (el.geometry?.length > 1) {
        const pts = el.geometry.map((g: any) => [g.lat, g.lon] as [number, number]);
        const closed = !cat.line && pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
        group.addLayer(closed
          ? L.polygon(pts, { renderer, color: cat.color, weight: 1.5, fillColor: cat.color, fillOpacity: 0.35 })
          : L.polyline(pts, { renderer, color: cat.color, weight: cat.line ? 2.5 : 1.5 }));
      }
    }
    legend.textContent = "";
    let total = 0;
    for (const c of cats) {
      const n = counts.get(c.id) ?? 0; total += n;
      const li = document.createElement("li");
      li.innerHTML = `<i style="background:${c.color}"></i>`;
      li.append(`${c.emoji} ${c.label}`);
      const num = document.createElement("b"); num.textContent = String(n); li.append(num);
      legend.append(li);
    }
    const capped = (data.elements?.length ?? 0) >= MAX;
    say(total ? `${total} found in view${capped ? ` (capped at ${MAX} — zoom in for all)` : ""}. Counts come from OpenStreetMap, so unmapped places are missed.` : "Nothing mapped in this view. Try another spot or category.", !total);
    clear.hidden = false;
  }

  btn.addEventListener("click", run);
  clear.addEventListener("click", () => { group.clearLayers(); legend.textContent = ""; clear.hidden = true; say("Cleared."); });
  clear.hidden = true;
}
