import type { Ctx } from "./ctx";
import { el } from "./ctx";
import { ageText } from "./format";

interface Item { id: string; kind: string; emoji: string; title: string; when: number; lat: number; lon: number; zoom: number; compare: boolean; detail?: string }

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

const CATS: Record<string, { kind: string; emoji: string; zoom: number; compare: boolean }> = {
  wildfires: { kind: "Fire", emoji: "🔥", zoom: 11, compare: true },
  volcanoes: { kind: "Volcano", emoji: "🌋", zoom: 11, compare: true },
  floods: { kind: "Flood", emoji: "🌊", zoom: 10, compare: true },
  severeStorms: { kind: "Storm", emoji: "🌀", zoom: 6, compare: false },
  seaLakeIce: { kind: "Ice", emoji: "🧊", zoom: 7, compare: false },
  landslides: { kind: "Landslide", emoji: "⛰️", zoom: 12, compare: true },
  drought: { kind: "Drought", emoji: "🏜️", zoom: 8, compare: false },
  dustHaze: { kind: "Dust", emoji: "🌫️", zoom: 7, compare: false },
  snow: { kind: "Snow", emoji: "❄️", zoom: 8, compare: false },
  tempExtremes: { kind: "Heat", emoji: "🌡️", zoom: 7, compare: false },
};

async function eonet(): Promise<Item[]> {
  const r = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=21&limit=60");
  if (!r.ok) throw new Error(`EONET ${r.status}`);
  const j = await r.json();
  const out: Item[] = [];
  for (const e of j.events ?? []) {
    const cat = CATS[e.categories?.[0]?.id];
    const g = [...(e.geometry ?? [])].reverse().find((x: any) => x.type === "Point") ?? e.geometry?.[e.geometry.length - 1];
    if (!cat || !g) continue;
    let lon: number, lat: number;
    if (g.type === "Point") [lon, lat] = g.coordinates;
    else { const ring = g.coordinates?.[0]; if (!ring?.length) continue; lon = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length; lat = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length; }
    // when the event began, not its latest update
    const started = Date.parse(e.geometry?.[0]?.date ?? g.date);
    const mag = g.magnitudeValue ? ` · ${g.magnitudeValue} ${g.magnitudeUnit ?? ""}` : "";
    out.push({ id: e.id, ...cat, title: e.title, when: Date.parse(g.date) || started, lat, lon, detail: `Started ${ageText(new Date(started).toISOString())}${mag}`, compare: cat.compare });
  }
  return out;
}

async function quakes(): Promise<Item[]> {
  const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson");
  if (!r.ok) throw new Error(`USGS ${r.status}`);
  const j = await r.json();
  return (j.features ?? [])
    .filter((f: any) => f.properties.mag >= 5)
    .map((f: any): Item => ({
      id: f.id, kind: "Quake", emoji: "🫨", title: `M${f.properties.mag.toFixed(1)} · ${f.properties.place}`,
      when: f.properties.time, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
      zoom: f.properties.mag >= 6.5 ? 8 : 10, compare: f.properties.mag >= 6.5,
      detail: `${ageText(new Date(f.properties.time).toISOString())} · depth ${Math.round(f.geometry.coordinates[2])} km`,
    }));
}

const GD: Record<string, { kind: string; emoji: string; zoom: number; compare: boolean }> = {
  FL: { kind: "Flood", emoji: "🌊", zoom: 9, compare: true },
  TC: { kind: "Storm", emoji: "🌀", zoom: 6, compare: false },
  VO: { kind: "Volcano", emoji: "🌋", zoom: 11, compare: true },
  WF: { kind: "Fire", emoji: "🔥", zoom: 10, compare: true },
};
const ALERT: Record<string, string> = { Red: "🔴 Red alert", Orange: "🟠 Orange alert", Green: "🟢 Green" };

/** UN/EU Global Disaster Alert and Coordination System: floods (incl. flash floods), cyclones, volcanoes. */
async function gdacs(): Promise<Item[]> {
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);
  const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=FL;TC;VO;WF&fromdate=${d(Date.now() - 21 * DAY)}&todate=${d(Date.now())}&alertlevel=Green;Orange;Red`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GDACS ${r.status}`);
  const j = await r.json();
  const out: Item[] = [];
  for (const f of j.features ?? []) {
    const p = f.properties ?? {};
    const cat = GD[p.eventtype];
    const g = f.geometry;
    if (!cat || !g) continue;
    let lon: number, lat: number;
    if (g.type === "Point") [lon, lat] = g.coordinates;
    else continue;
    const started = Date.parse(p.fromdate + "Z");
    const title = [p.name || p.eventname, p.country].filter(Boolean).join(" · ");
    out.push({
      id: `gdacs-${p.eventtype}-${p.eventid}`, ...cat, title, when: Date.parse((p.datemodified || p.fromdate) + "Z") || started,
      lat, lon, detail: `${ALERT[p.alertlevel] ?? p.alertlevel} · started ${ageText(new Date(started).toISOString())}`,
    });
  }
  return out;
}

export function initNews(ctx: Ctx) {
  const list = el("newsList"), status = el("newsStatus"), refresh = el<HTMLButtonElement>("newsRefresh"), chips = el("newsChips");
  let items: Item[] = [];
  let filter = "All";
  let loadedAt = 0;

  function render() {
    list.textContent = "";
    const shown = items.filter((i) => filter === "All" || i.kind === filter);
    chips.textContent = "";
    for (const k of ["All", ...new Set(items.map((i) => i.kind))]) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (k === filter ? " on" : ""); b.textContent = k;
      b.addEventListener("click", () => { filter = k; render(); });
      chips.append(b);
    }
    for (const i of shown) {
      const li = document.createElement("li");
      const go = document.createElement("button"); go.className = "favgo";
      const t = document.createElement("strong"); t.textContent = `${i.emoji} ${i.title}`;
      const d = document.createElement("span"); d.textContent = i.detail ?? "";
      go.append(t, d);
      go.addEventListener("click", () => {
        const ev = i.when;
        ctx.goTo({
          lat: i.lat, lon: i.lon, zoom: i.zoom, name: i.title,
          ...(i.compare ? {
            source: "s2" as const,
            compare: { before: iso(ev - 12 * DAY), after: ev + 6 * DAY > Date.now() - 2 * DAY ? "latest" : iso(ev + 6 * DAY) },
          } : {}),
        });
      });
      li.append(go);
      if (i.compare) { const tag = document.createElement("small"); tag.className = "cmpTag"; tag.textContent = "⇄"; tag.title = "Opens a before/after comparison"; li.append(tag); }
      list.append(li);
    }
    if (!shown.length) { const e = document.createElement("li"); e.className = "empty"; e.textContent = "Nothing in this category right now."; list.append(e); }
  }

  async function load(force = false) {
    if (!force && items.length && Date.now() - loadedAt < 10 * 60_000) return;
    refresh.disabled = true; status.textContent = "Loading recent events…"; status.classList.remove("warn");
    const [a, b, c] = await Promise.allSettled([eonet(), quakes(), gdacs()]);
    const all = [a, b, c].flatMap((x) => (x.status === "fulfilled" ? x.value : []));
    // The same flood/fire can appear in two feeds: keep one per kind within ~50 km and 3 days.
    const kept: Item[] = [];
    for (const i of all.sort((x, y) => y.when - x.when)) {
      const dup = kept.some((k) => k.kind === i.kind && Math.abs(k.lat - i.lat) < 0.5 && Math.abs(k.lon - i.lon) < 0.5 && Math.abs(k.when - i.when) < 3 * DAY);
      if (!dup) kept.push(i);
    }
    items = kept.slice(0, 80);
    refresh.disabled = false;
    if (!items.length) {
      status.textContent = "Couldn't load events right now. Check your connection and refresh."; status.classList.add("warn");
    } else {
      loadedAt = Date.now();
      const failed = [a, b, c].filter((x) => x.status === "rejected").length;
      status.textContent = `${items.length} events from NASA EONET, USGS and GDACS${failed ? " (one source unavailable)" : ""}. ⇄ opens before/after.`;
    }
    render();
  }

  refresh.addEventListener("click", () => load(true));
  // load when the Discover tab is first opened
  document.querySelector('.tabs [data-tab="discover"]')!.addEventListener("click", () => void load());
}
