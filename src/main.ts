import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { CONFIG } from "./config";
import { ageText, dateText, timeText, haversineKm } from "./format";
import { decodeHash, encodeHash } from "./hash";
import { searchPlace } from "./geocode";
import { searchScenes, type Scene } from "./stac";
import type { Ctx, GoTarget } from "./ctx";
import { initCompare } from "./compare";
import { initNews } from "./news";
import { initSuggest } from "./suggest";
import { initFind } from "./find";
import { initSaved, initDiscover } from "./saved";
import { initAnnotate, captureMap } from "./annotate";
import { parseLocation, links } from "./location";
import { loadPrefs, savePrefs, exportAll, importAll, download } from "./prefs";
import { SOURCES, sourceById, sourceOfScene, dailyScenes, staticScenes, type SourceId } from "./sources";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  panel: $("panel"),
  collapse: $<HTMLButtonElement>("collapse"),
  share: $<HTMLButtonElement>("share"),
  form: $<HTMLFormElement>("searchForm"),
  q: $<HTMLInputElement>("q"),
  searchBtn: $<HTMLButtonElement>("searchBtn"),
  findBtn: $<HTMLButtonElement>("findBtn"),
  days: $("days"),
  cloud: $<HTMLInputElement>("cloud"),
  cloudVal: $("cloudVal"),
  opacity: $<HTMLInputElement>("opacity"),
  opacityVal: $("opacityVal"),
  quick: $<HTMLInputElement>("quick"),
  status: $("status"),
  stepper: $("stepper"),
  stepDate: $("stepDate"),
  stepAge: $("stepAge"),
  older: $<HTMLButtonElement>("older"),
  newer: $<HTMLButtonElement>("newer"),
  results: $("results"),
  toast: $("toast"),
  yr: $("yr"),
  credit: $("credit"),
  sources: $("sources"),
  blurb: $("sourceBlurb"),
  maxZoom: $<HTMLButtonElement>("maxZoom"),
  zoomInfo: $("zoomInfo"),
};
el.yr.textContent = String(new Date().getFullYear());

// ---- State ----
let days = CONFIG.defaults.days;
let sourceId: SourceId = "s2";
let scenes: Scene[] = [];
let selectedId: string | null = null;
let lastSearch: [number, number] | null = null;
let searchCtl: AbortController | null = null;
let researchTimer: number | undefined;
let tileErrors = 0;
let cmp: ReturnType<typeof initCompare> | null = null;

// ---- Map ----
const prefs = loadPrefs();
if (prefs.days) days = prefs.days;
if (prefs.source && SOURCES.some((x) => x.id === prefs.source)) sourceId = prefs.source as SourceId;
const initial = decodeHash(location.hash);
if (initial?.scene) sourceId = sourceOfScene(initial.scene);
const map = L.map("map", { worldCopyJump: true, zoomControl: false, maxZoom: 19 }).setView(
  initial ? [initial.lat, initial.lon] : CONFIG.startView,
  initial ? initial.zoom : CONFIG.startZoom,
);
L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer(CONFIG.baseMap.url, {
  maxZoom: 19,
  className: "basemap",
  crossOrigin: true,
  attribution: CONFIG.baseMap.attribution,
}).addTo(map);

let marker: L.CircleMarker | null = null;
let imageLayer: L.TileLayer | L.ImageOverlay | null = null;
let outline: L.GeoJSON | null = null;

function dropMarker(lat: number, lon: number, name?: string) {
  if (marker) map.removeLayer(marker);
  marker = L.circleMarker([lat, lon], {
    radius: 7, color: "#fff", weight: 3, fillColor: "#14b8a6", fillOpacity: 1,
  }).addTo(map);
  if (name) marker.bindPopup(name);
}

// ---- UI helpers ----
function setStatus(text: string, warn = false) {
  el.status.textContent = text;
  el.status.classList.toggle("warn", warn);
}

let toastTimer: number | undefined;
function toast(text: string) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.toast.hidden = true), 5000);
}

function setBusy(busy: boolean) {
  el.panel.classList.toggle("busy", busy);
  el.findBtn.disabled = busy;
}

function cloudClass(c: number | null) {
  if (c === null) return "";
  return c <= 5 ? "clear" : c <= 15 ? "mostly" : "cloudy";
}

// ---- Image search ----
async function findImages(preselect?: string, nearestTo?: string) {
  searchCtl?.abort();
  const ctl = (searchCtl = new AbortController());
  const c = map.getCenter();
  lastSearch = [c.lat, c.lng];
  const maxCloud = parseInt(el.cloud.value, 10);

  setBusy(true);
  setStatus("Looking for images…");
  try {
    const src = sourceById(sourceId);
    const found =
      src.kind === "stac" ? await searchScenes(c.lat, c.lng, days, maxCloud, ctl.signal)
      : src.kind === "daily" ? dailyScenes(src, days, c.lat, c.lng)
      : staticScenes(src);
    if (ctl.signal.aborted) return;
    scenes = found;
    renderResults();
    if (!scenes.length) {
      setStatus(`No images under ${maxCloud}% cloud in the last ${days} days. Try a longer look-back or allow more cloud.`, true);
    } else {
      if (src.kind === "stac") setStatus(`${scenes.length} image${scenes.length === 1 ? "" : "s"}, newest first.`);
      let keep = preselect ? scenes.find((s) => s.id === preselect) : undefined;
      if (!keep && nearestTo && scenes[0].datetime) {
        const t = Date.parse(nearestTo);
        keep = scenes.reduce((a, b) => Math.abs(Date.parse(b.datetime) - t) < Math.abs(Date.parse(a.datetime) - t) ? b : a);
      }
      select((keep || scenes[0]).id, !!keep);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    setStatus(`Image search failed: ${(err as Error).message}. Check your connection and try again.`, true);
  } finally {
    if (!ctl.signal.aborted) setBusy(false);
  }
}

function renderResults() {
  el.results.textContent = "";
  selectedId = null;
  clearImage();
  el.stepper.hidden = scenes.length < 2;
  for (const s of scenes) {
    const li = document.createElement("li");
    li.dataset.id = s.id;
    li.tabIndex = 0;
    li.setAttribute("role", "button");

    const thumb = document.createElement("img");
    thumb.loading = "lazy";
    thumb.alt = "";
    if (s.thumbnail) thumb.src = s.thumbnail;
    else thumb.hidden = true;
    thumb.addEventListener("error", () => thumb.remove());

    const text = document.createElement("div");
    text.className = "meta";
    const when = document.createElement("strong");
    when.textContent = s.title ?? dateText(s.datetime);
    const sub = document.createElement("span");
    sub.textContent = s.subtitle ?? `${timeText(s.datetime)} · ${ageText(s.datetime)}`;
    text.append(when, sub);
    if (!s.title) {
      const tile = document.createElement("small");
      tile.textContent = s.id;
      text.append(tile);
    }

    const badge = document.createElement("span");
    badge.className = `badge ${cloudClass(s.cloud)}`;
    badge.textContent = s.cloud === null ? "?" : `${Math.round(s.cloud)}%`;
    badge.title = "Cloud cover";

    li.append(thumb, text);
    if (s.cloud !== null) li.append(badge);
    li.addEventListener("click", () => select(s.id, false));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(s.id, false); }
    });
    el.results.append(li);
  }
}

function clearImage() {
  if (imageLayer) map.removeLayer(imageLayer);
  if (outline) map.removeLayer(outline);
  imageLayer = outline = null;
}

function select(id: string, keepView: boolean) {
  const s = scenes.find((x) => x.id === id);
  if (!s) return;
  cmp?.stop(false);
  selectedId = id;
  tileErrors = 0;
  el.results.querySelectorAll("li").forEach((li) => {
    const on = li.dataset.id === id;
    li.classList.toggle("selected", on);
    if (on) keepVisible(li as HTMLElement);
  });
  clearImage();

  const src = sourceById(sourceId);
  const opacity = parseInt(el.opacity.value, 10) / 100;
  const bounds = s.bbox ? L.latLngBounds([s.bbox[1], s.bbox[0]], [s.bbox[3], s.bbox[2]]) : undefined;
  const when = s.datetime ? `${dateText(s.datetime)}${src.kind === "stac" ? `, ${timeText(s.datetime)} (your local time)` : " (UTC day)"}` : "latest mosaic";

  if (src.kind === "stac" && el.quick.checked) {
    if (!s.thumbnail || !bounds) {
      setStatus("This image has no quick preview. Untick the box to use full tiles.", true);
    } else {
      imageLayer = L.imageOverlay(s.thumbnail, bounds, { opacity }).addTo(map);
      setStatus("Low-detail preview of the whole scene.");
    }
  } else if (!s.tiles) {
    setStatus(`This image has no '${CONFIG.asset}' file. Try another one.`, true);
  } else {
    const layer = L.tileLayer(s.tiles, {
      bounds, opacity, maxZoom: 19, maxNativeZoom: s.maxNative, crossOrigin: true,
    }).addTo(map);
    layer.on("tileerror", () => {
      if (++tileErrors === 6) {
        setStatus("Image tiles are failing to load. The tile server may be busy, or this date is not published yet — try another date or source.", true);
      }
    });
    imageLayer = layer;
    setStatus(`${src.name}: ${when}.`);
  }

  if (s.geometry) {
    outline = L.geoJSON(s.geometry, {
      style: { color: "#14b8a6", weight: 1.5, fill: false, dashArray: "6 5" },
      interactive: false,
    }).addTo(map);
  }
  el.stepDate.textContent = s.title ?? dateText(s.datetime);
  el.stepAge.textContent = s.subtitle ?? `${timeText(s.datetime)} · ${ageText(s.datetime)}`;
  const i = scenes.indexOf(s);
  el.newer.disabled = i === 0;
  el.older.disabled = i === scenes.length - 1;
  syncHash();
}

/** Scroll only the list that holds the item, never the whole panel. */
function keepVisible(item: HTMLElement) {
  const sc = [el.results, item.closest<HTMLElement>(".tab")].find((x) => x && x.scrollHeight > x.clientHeight + 1);
  if (!sc) return;
  const a = item.getBoundingClientRect(), b = sc.getBoundingClientRect();
  if (a.top < b.top) sc.scrollTop -= b.top - a.top + 8;
  else if (a.bottom > b.bottom) sc.scrollTop += a.bottom - b.bottom + 8;
}

function step(dir: -1 | 1) {
  const i = scenes.findIndex((s) => s.id === selectedId);
  const next = scenes[i + dir];
  if (next) select(next.id, true);
}

// ---- Place search ----
let placeName = "";
function goTo(t: GoTarget) {
  if (t.source && t.source !== sourceId) { sourceId = t.source; applySourceUi(); }
  placeName = t.name ?? "";
  dropMarker(t.lat, t.lon, t.name);
  if (t.name) setStatus(`Found: ${t.name}`);
  const zoom = t.zoom ?? CONFIG.searchZoom;
  const here = map.getCenter();
  const run = () => (t.compare && cmp ? void cmp.start(t.lat, t.lon, t.compare) : (cmp?.stop(false), void findImages()));
  if (!t.bounds && map.distance(here, [t.lat, t.lon]) < 5 && Math.round(map.getZoom()) === zoom) {
    run();
    return;
  }
  map.once("moveend", run);
  if (t.bounds) {
    map.flyToBounds([[t.bounds[0], t.bounds[1]], [t.bounds[2], t.bounds[3]]], { maxZoom: Math.max(zoom, 14), duration: 1.2 });
  } else {
    map.flyTo([t.lat, t.lon], zoom, { duration: 1.2 });
  }
}

const suggest = initSuggest(
  el.q, $("suggest") as HTMLUListElement,
  () => { const c = map.getCenter(); return { lat: c.lat, lon: c.lng, zoom: map.getZoom() }; },
  goTo,
);

el.form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = el.q.value.trim();
  if (!text) return;
  suggest.close();
  const loc = parseLocation(text);
  if (loc) return goTo(loc);
  // Autocorrect: the first suggestion is Photon's typo-tolerant best match.
  const guess = suggest.first();
  if (guess) { el.q.value = (guess.name ?? text).split(",")[0]; return goTo(guess); }
  el.searchBtn.disabled = true;
  setStatus("Searching for the place…");
  try {
    goTo(await searchPlace(text));
  } catch (err) {
    setStatus(`Place search failed: ${(err as Error).message}`, true);
  } finally {
    setTimeout(() => (el.searchBtn.disabled = false), 1000);
  }
});

// ---- Controls ----
function setDays(v: number) {
  days = v;
  el.days.querySelectorAll("button").forEach((b) => {
    const on = Number(b.dataset.v) === v;
    b.setAttribute("aria-checked", String(on));
    b.classList.toggle("on", on);
  });
}
setDays(days);
el.days.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  setDays(Number(b.dataset.v));
  persist();
  if (lastSearch) findImages(selectedId ?? undefined);
});

function persist() {
  savePrefs({ source: sourceId, days, cloud: +el.cloud.value, opacity: +el.opacity.value, quick: el.quick.checked });
}
el.cloud.addEventListener("input", () => { el.cloudVal.textContent = `${el.cloud.value}%`; persist(); });
el.cloud.addEventListener("change", () => lastSearch && findImages(selectedId ?? undefined));
el.opacity.addEventListener("input", () => {
  el.opacityVal.textContent = `${el.opacity.value}%`;
  persist();
  imageLayer?.setOpacity(parseInt(el.opacity.value, 10) / 100);
});
el.quick.addEventListener("change", () => selectedId && select(selectedId, true));
el.findBtn.addEventListener("click", () => findImages(selectedId ?? undefined));
el.older.addEventListener("click", () => step(1));
el.newer.addEventListener("click", () => step(-1));
el.share.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast("Link copied");
  } catch {
    toast("Copy failed — use the address bar");
  }
});
el.collapse.addEventListener("click", () => {
  const collapsed = el.panel.classList.toggle("collapsed");
  el.collapse.setAttribute("aria-expanded", String(!collapsed));
});

document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (t.matches("input[type=search], input[type=text]")) return;
  if (e.key === "ArrowLeft") { step(1); e.preventDefault(); }
  if (e.key === "ArrowRight") { step(-1); e.preventDefault(); }
});

// ---- Shareable URL + auto re-search ----
function syncHash() {
  const c = map.getCenter();
  history.replaceState(null, "", encodeHash({ lat: c.lat, lon: c.lng, zoom: map.getZoom(), scene: selectedId ?? undefined }));
}

map.on("moveend", () => {
  syncHash();
  updateZoomInfo();
  if (cmp?.active() || !lastSearch || map.getZoom() < 8 || sourceById(sourceId).kind !== "stac") return;
  const c = map.getCenter();
  const sel = scenes.find((s) => s.id === selectedId);
  if (sel?.bbox && sel.bbox[0] <= c.lng && c.lng <= sel.bbox[2] && sel.bbox[1] <= c.lat && c.lat <= sel.bbox[3]) return;
  if (haversineKm(lastSearch, [c.lat, c.lng]) < CONFIG.researchKm) return;
  clearTimeout(researchTimer);
  researchTimer = window.setTimeout(() => findImages(), 900);
});

// ---- Sources ----
function renderSources() {
  el.sources.textContent = "";
  for (const src of SOURCES) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.id = src.id;
    b.title = `${src.name} — ${src.res}`;
    const n = document.createElement("strong");
    n.textContent = src.name;
    const r = document.createElement("span");
    r.textContent = src.res;
    b.append(n, r);
    b.addEventListener("click", () => setSource(src.id));
    el.sources.append(b);
  }
}

function applySourceUi() {
  const src = sourceById(sourceId);
  el.sources.querySelectorAll("button").forEach((b) => {
    const on = b.dataset.id === sourceId;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  el.blurb.textContent = src.blurb;
  el.credit.textContent = src.credit;
  document.querySelectorAll<HTMLElement>("[data-needs]").forEach((f) => {
    const need = f.dataset.needs;
    f.hidden = need === "cloud" ? !src.usesCloud : need === "compare" ? src.kind === "static" : !src.usesDays;
  });
  updateZoomInfo();
}

function setSource(id: SourceId) {
  if (id === sourceId) return;
  const prev = scenes.find((s) => s.id === selectedId);
  cmp?.stop(false);
  sourceId = id;
  persist();
  applySourceUi();
  searchCtl?.abort();
  lastSearch = null;
  const c = map.getCenter();
  lastSearch = [c.lat, c.lng];
  void findImages(undefined, prev?.datetime);
}

// ---- Max zoom ----
function updateZoomInfo() {
  const native = sourceById(sourceId).maxNative;
  const z = Math.round(map.getZoom());
  el.zoomInfo.textContent = z > native ? `Zoom ${z} · enlarged beyond real detail (${native})` : `Zoom ${z} of ${native}`;
  el.zoomInfo.classList.toggle("over", z > native);
}
el.maxZoom.addEventListener("click", () => {
  map.flyTo(map.getCenter(), sourceById(sourceId).maxNative, { duration: 0.8 });
});

renderSources();
applySourceUi();

// ---- Boot ----
if (window.matchMedia("(max-width: 760px)").matches) {
  ($("filters") as HTMLDetailsElement).open = false;
}
el.cloud.value = String(prefs.cloud ?? CONFIG.defaults.cloud);
el.cloudVal.textContent = `${el.cloud.value}%`;
el.opacity.value = String(prefs.opacity ?? CONFIG.defaults.opacity);
el.opacityVal.textContent = `${el.opacity.value}%`;
el.quick.checked = !!prefs.quick;
if (initial && (initial.zoom >= 8 || initial.scene)) {
  dropMarker(initial.lat, initial.lon);
  void findImages(initial.scene);
}

// ---- Tabs ----
function showTab(name: string) {
  document.querySelectorAll<HTMLElement>(".tab").forEach((t) => (t.hidden = t.dataset.tab !== name));
  document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
  });
  el.panel.classList.remove("collapsed");
}
document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab!)));

// ---- Features that sit on top of the map ----
const ctx: Ctx = {
  map, goTo, showTab, toast, clearImage,
  restore: () => { if (selectedId) select(selectedId, true); },
  currentSource: () => sourceId,
  lastName: () => placeName,
};
cmp = initCompare(ctx);
initNews(ctx);
initFind(ctx);
initSaved(ctx);
initDiscover(ctx);
initAnnotate(ctx);

const where = () => { const c = map.getCenter(); return { lat: c.lat, lon: c.lng, zoom: map.getZoom() }; };
async function copy(text: string, ok: string) {
  try { await navigator.clipboard.writeText(text); toast(ok); } catch { toast("Copy failed"); }
}
function refreshSendLinks() {
  ($("openGoogle") as HTMLAnchorElement).href = links.google(where());
  ($("openOsm") as HTMLAnchorElement).href = links.osm(where());
}
map.on("moveend", refreshSendLinks);
refreshSendLinks();
$("sendLink").addEventListener("click", () => copy(location.href, "Link copied"));
$("sendCoords").addEventListener("click", () => copy(links.coords(where()), "Coordinates copied"));
$("sendShare").addEventListener("click", async () => {
  const data = { title: "Satellite view", text: placeName || links.coords(where()), url: location.href };
  if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
  else copy(location.href, "Sharing not supported here — link copied");
});
$("openForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = parseLocation(($("openText") as HTMLInputElement).value);
  if (!t) return toast("Couldn't find coordinates in that text");
  goTo(t);
  ($("openText") as HTMLInputElement).value = "";
});

// Screenshot
async function shot(): Promise<Blob | null> {
  const w = where();
  const sel = scenes.find((x) => x.id === selectedId);
  const src = sourceById(sourceId);
  const when = sel?.datetime ? dateText(sel.datetime) + (src.kind === "stac" ? " " + timeText(sel.datetime) : " (UTC day)") : "archive mosaic";
  const cmpCap = cmp?.caption();
  const caption = `${src.name} · ${cmpCap ?? when} · ${links.coords(w)} · z${Math.round(w.zoom)} · ${src.credit} · © OpenStreetMap`;
  try { return await captureMap(map, { caption }); }
  catch { toast("This imagery server blocks image capture. Try another source."); return null; }
}
$("shotSave").addEventListener("click", async () => {
  const b = await shot();
  if (!b) return;
  const w = where();
  download(`satellite-${sourceId}-${w.lat.toFixed(3)}_${w.lon.toFixed(3)}.png`, b);
  toast("Screenshot saved");
});
$("shotCopy").addEventListener("click", async () => {
  const b = await shot();
  if (!b) return;
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); toast("Image copied"); }
  catch { toast("Copy not supported here — use Save PNG"); }
});

// Backup
$("exportAll").addEventListener("click", () => {
  download("satellite-viewer-backup.json", new Blob([exportAll()], { type: "application/json" }));
  toast("Backup downloaded");
});
const importFile = $("importFile") as HTMLInputElement;
$("importAll").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const f = importFile.files?.[0];
  importFile.value = "";
  if (!f) return;
  try {
    const r = importAll(await f.text());
    toast(`Imported ${r.favs} places, ${r.notes} drawings${r.prefs ? " and settings" : ""}. Reloading…`);
    setTimeout(() => location.reload(), 1200);
  } catch (e) { toast(`Import failed: ${(e as Error).message}`); }
});
