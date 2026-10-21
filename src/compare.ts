import L from "leaflet";
import type { Ctx } from "./ctx";
import { el } from "./ctx";
import { searchScenes, type Scene } from "./stac";
import { dailyScene, sourceById } from "./sources";
import { dateText } from "./format";

const DAY = 86_400_000;

export interface Range { before: string; after: string }

/** Best scene near a date: low cloud first, then closest in time. */
async function pickScene(src: ReturnType<typeof sourceById>, lat: number, lon: number, date: string, signal: AbortSignal): Promise<Scene | null> {
  if (src.kind === "daily") return dailyScene(src, date === "latest" ? new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10) : date, lat, lon);
  const target = date === "latest" ? Date.now() : Date.parse(date + "T12:00:00Z");
  for (const spread of date === "latest" ? [20, 45] : [12, 30, 75]) {
    const list = await searchScenes(lat, lon, 0, 70, signal, { start: new Date(target - spread * DAY), end: new Date(Math.min(Date.now(), target + (date === "latest" ? 0 : spread) * DAY)) });
    const usable = list.filter((s) => s.tiles);
    if (!usable.length) continue;
    const score = (s: Scene) => (s.cloud ?? 50) + (Math.abs(Date.parse(s.datetime) - target) / DAY) * (date === "latest" ? 3 : 1.5);
    return usable.reduce((a, b) => (score(b) < score(a) ? b : a));
  }
  return null;
}

export function initCompare(ctx: Ctx) {
  const { map } = ctx;
  const form = el<HTMLFormElement>("cmpForm"), bIn = el<HTMLInputElement>("cmpBefore"), aIn = el<HTMLInputElement>("cmpAfter");
  const info = el("cmpInfo"), status = el("cmpStatus"), exit = el<HTMLButtonElement>("cmpExit"), go = el<HTMLButtonElement>("cmpGo");
  const box = el<HTMLDetailsElement>("cmpBox");

  const divider = document.createElement("div");
  divider.id = "cmpDivider"; divider.hidden = true;
  divider.innerHTML = '<i class="lab b">Before</i><i class="lab a">After</i><span class="grip"></span>';
  map.getContainer().append(divider);
  for (const ev of ["pointerdown", "mousedown", "touchstart", "dblclick", "click", "wheel"]) {
    divider.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== "wheel" });
  }

  // Floating bar on the map so the comparison can be read and closed from any tab.
  const bar = document.createElement("div");
  bar.id = "cmpBar"; bar.hidden = true;
  const barText = document.createElement("span");
  const barExit = document.createElement("button");
  barExit.type = "button"; barExit.textContent = "Exit comparison";
  bar.append(barText, barExit);
  map.getContainer().append(bar);
  for (const ev of ["pointerdown", "mousedown", "touchstart", "dblclick", "click", "wheel"]) {
    bar.addEventListener(ev, (e) => e.stopPropagation());
  }

  let layers: { before: L.TileLayer; after: L.TileLayer } | null = null;
  let pos = 0.5;
  let scenes: { before: Scene; after: Scene } | null = null;
  let ctl: AbortController | null = null;

  const active = () => !!layers;

  function defaultPos() {
    const w = map.getSize().x;
    const panel = el("panel").getBoundingClientRect();
    return w > 760 ? Math.min(0.9, (panel.right + (w - panel.right) / 2) / w) : 0.5;
  }

  function applyClip() {
    if (!layers) return;
    const size = map.getSize();
    const x = size.x * pos;
    const nw = map.containerPointToLayerPoint([0, 0]);
    const se = map.containerPointToLayerPoint(size);
    const mid = map.containerPointToLayerPoint([x, 0]).x;
    const b = layers.before.getContainer(), a = layers.after.getContainer();
    if (b) { b.style.clip = `rect(${nw.y}px, ${mid}px, ${se.y}px, ${nw.x}px)`; b.dataset.side = "l"; }
    if (a) { a.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${mid}px)`; a.dataset.side = "r"; }
    divider.style.left = `${x}px`;
    map.getContainer().dataset.cmpX = String(x);
  }

  // drag the divider
  let drag = false;
  divider.addEventListener("pointerdown", (e) => { drag = true; divider.setPointerCapture(e.pointerId); });
  divider.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = map.getContainer().getBoundingClientRect();
    pos = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width));
    applyClip();
  });
  divider.addEventListener("pointerup", () => (drag = false));
  map.on("move zoom resize viewreset", applyClip);

  function stop(restore = true) {
    ctl?.abort();
    if (layers) { map.removeLayer(layers.before); map.removeLayer(layers.after); }
    layers = null; scenes = null; divider.hidden = true;
    delete map.getContainer().dataset.cmpX;
    info.hidden = true; exit.hidden = true; bar.hidden = true;
    if (restore) ctx.restore();
  }

  const say = (t: string, warn = false) => {
    status.textContent = t; status.classList.toggle("warn", warn);
    barText.textContent = t; bar.classList.toggle("warn", warn);
    bar.hidden = false;
    barExit.hidden = !layers;
  };

  async function start(lat: number, lon: number, r: Range) {
    stop(false);
    ctx.clearImage();
    bIn.value = r.before === "latest" ? "" : r.before;
    aIn.value = r.after === "latest" ? "" : r.after;
    box.open = true;
    info.hidden = false;
    go.disabled = true;
    say("Finding the clearest images for both dates…");
    const mine = (ctl = new AbortController());
    const src = sourceById(ctx.currentSource());
    try {
      const [b, a] = await Promise.all([pickScene(src, lat, lon, r.before, mine.signal), pickScene(src, lat, lon, r.after, mine.signal)]);
      if (mine.signal.aborted) return;
      if (!b || !a) {
        say(`No usable ${src.name} image near ${!b ? "the “before”" : "the “after”"} date here. Try other dates, or a longer gap.`, true);
        return;
      }
      scenes = { before: b, after: a };
      const mk = (s: Scene) => L.tileLayer(s.tiles!, { maxZoom: 19, maxNativeZoom: s.maxNative, crossOrigin: true, bounds: s.bbox ? L.latLngBounds([s.bbox[1], s.bbox[0]], [s.bbox[3], s.bbox[2]]) : undefined }).addTo(map);
      layers = { before: mk(b), after: mk(a) };
      pos = defaultPos();
      divider.hidden = false;
      (divider.querySelector(".lab.b") as HTMLElement).textContent = `Before · ${dateText(b.datetime)}`;
      (divider.querySelector(".lab.a") as HTMLElement).textContent = `After · ${dateText(a.datetime)}`;
      applyClip();
      exit.hidden = false;
      const cl = (s: Scene) => (s.cloud == null ? "" : ` · ${Math.round(s.cloud)}% cloud`);
      say(`Before ${dateText(b.datetime)}${cl(b)}  →  After ${dateText(a.datetime)}${cl(a)}. Drag the divider.`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") say(`Comparison failed: ${(e as Error).message}`, true);
    } finally {
      go.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const c = map.getCenter();
    void start(c.lat, c.lng, { before: bIn.value || "latest", after: aIn.value || "latest" });
  });
  const close = () => { stop(true); status.textContent = "Comparison closed."; };
  exit.addEventListener("click", close);
  barExit.addEventListener("click", close);
  // failed comparisons leave the bar up with a message; let it be dismissed by tapping it
  bar.addEventListener("dblclick", () => { if (!layers) bar.hidden = true; });

  return {
    start, stop, active,
    caption: () => (scenes ? `Before ${dateText(scenes.before.datetime)} | After ${dateText(scenes.after.datetime)}` : null),
  };
}
