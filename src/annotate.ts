import L from "leaflet";
import type { Ctx } from "./ctx";

export type Tool = "pin" | "text" | "line" | "poly" | "pen" | "circle";
type LL = [number, number];
export interface Note { id: string; type: Tool; pts: LL[]; color: string; text?: string; radius?: number }

const KEY = "rsv.notes.v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const COLORS = ["#14b8a6", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#ffffff"];

let items: Note[] = [];
try { items = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { items = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ } };
const subs = new Set<() => void>();

export const notes = {
  get items() { return items; },
  subscribe(f: () => void) { subs.add(f); },
  importItems(list: Note[]): number {
    let n = 0;
    for (const x of list) {
      if (x && x.type && Array.isArray(x.pts) && !items.some((i) => i.id === x.id)) { items.push({ ...x, id: x.id || uid() }); n++; }
    }
    save(); subs.forEach((f) => f());
    return n;
  },
};

// ---- measuring ----
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);
const fmtArea = (m2: number) => (m2 < 1e4 ? `${Math.round(m2)} m²` : m2 < 1e6 ? `${(m2 / 1e4).toFixed(2)} ha` : `${(m2 / 1e6).toFixed(2)} km²`);

function pathLength(map: L.Map, pts: LL[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += map.distance(pts[i - 1], pts[i]);
  return d;
}
function polyArea(pts: LL[]) {
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [y1, x1] = pts[i], [y2, x2] = pts[(i + 1) % pts.length];
    a += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
  }
  return Math.abs(a / 2);
}
const centroid = (pts: LL[]): LL => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

function label(map: L.Map, n: Note): string {
  switch (n.type) {
    case "line": return fmtDist(pathLength(map, n.pts));
    case "poly": return `${fmtArea(polyArea(n.pts))} · ${fmtDist(pathLength(map, [...n.pts, n.pts[0]]))}`;
    case "circle": return `r ${fmtDist(n.radius ?? 0)}`;
    default: return n.text ?? "";
  }
}

export function initAnnotate(ctx: Ctx) {
  const { map } = ctx;
  const group = L.layerGroup().addTo(map);
  const draft = L.layerGroup().addTo(map);
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  let tool: Tool | null = null;
  let color = COLORS[0];
  let pts: LL[] = [];
  let visible = true;
  let penDown = false;

  // ---- tool UI ----
  const toolBtns = document.querySelectorAll<HTMLButtonElement>("#tools [data-tool]");
  const hint = $("toolHint");
  const HINTS: Record<Tool, string> = {
    pin: "Click the map to drop a pin.", text: "Click the map to place a text label.",
    line: "Click points to measure a path. Double-click or Finish to end.",
    poly: "Click corners. Double-click or Finish to close and measure the area.",
    pen: "Press and drag to draw freehand.", circle: "Click the centre, then click the edge.",
  };
  function setTool(t: Tool | null) {
    finish();
    tool = t === tool ? null : t;
    toolBtns.forEach((b) => b.classList.toggle("on", b.dataset.tool === tool));
    hint.textContent = tool ? HINTS[tool] : "Pick a tool, then click or drag on the map.";
    map.getContainer().classList.toggle("drawing", !!tool);
    if (tool) { map.doubleClickZoom.disable(); } else { map.doubleClickZoom.enable(); }
    if (tool === "pen") map.dragging.disable(); else map.dragging.enable();
    if (tool && !visible) toggleVisible();
  }
  toolBtns.forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool as Tool)));

  const sw = $("swatches");
  COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sw" + (i === 0 ? " on" : "");
    b.style.background = c; b.setAttribute("aria-label", `Colour ${c}`);
    b.addEventListener("click", () => { color = c; sw.querySelectorAll(".sw").forEach((x) => x.classList.toggle("on", x === b)); });
    sw.append(b);
  });

  // ---- render ----
  function popupFor(n: Note): HTMLElement {
    const box = document.createElement("div"); box.className = "notepop";
    if (n.type === "pin" || n.type === "text") {
      const input = document.createElement("input");
      input.value = n.text ?? ""; input.placeholder = "Note…"; input.maxLength = 80;
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { n.text = input.value.trim(); save(); render(); map.closePopup(); } });
      const ok = document.createElement("button"); ok.textContent = "Save";
      ok.addEventListener("click", () => { n.text = input.value.trim(); save(); render(); map.closePopup(); });
      box.append(input, ok);
      setTimeout(() => input.focus(), 50);
    } else {
      const s = document.createElement("span"); s.textContent = label(map, n); box.append(s);
    }
    const del = document.createElement("button"); del.textContent = "Delete"; del.className = "danger";
    del.addEventListener("click", () => { items = items.filter((x) => x.id !== n.id); save(); render(); map.closePopup(); });
    box.append(del);
    return box;
  }

  function build(n: Note): L.Layer | null {
    const style = { color: n.color, weight: 3, opacity: 0.95 };
    let layer: L.Layer;
    if (n.type === "pin" || n.type === "text") {
      const html = n.type === "pin"
        ? `<div class="pin" style="--c:${n.color}"></div>${n.text ? `<div class="pinlabel"></div>` : ""}`
        : `<div class="textlabel" style="color:${n.color}"></div>`;
      const icon = L.divIcon({ className: "note-icon", html, iconSize: [0, 0] });
      const m = L.marker(n.pts[0], { icon, keyboard: false });
      m.on("add", () => {
        const e = m.getElement();
        const t = e?.querySelector<HTMLElement>(".pinlabel, .textlabel");
        if (t) t.textContent = n.text || (n.type === "text" ? "Text" : "");
      });
      layer = m;
    } else if (n.type === "line" || n.type === "pen") {
      layer = L.polyline(n.pts, style);
    } else if (n.type === "poly") {
      layer = L.polygon(n.pts, { ...style, fillOpacity: 0.15 });
    } else {
      layer = L.circle(n.pts[0], { ...style, radius: n.radius ?? 0, fillOpacity: 0.12 });
    }
    if (n.type === "line" || n.type === "poly" || n.type === "circle") {
      (layer as L.Path).bindTooltip(label(map, n), { permanent: true, direction: "center", className: "measure" });
    }
    layer.on("click", (e) => { if (tool) return; L.DomEvent.stopPropagation(e as any); L.popup({ closeButton: false }).setLatLng((e as any).latlng ?? n.pts[0]).setContent(popupFor(n)).openOn(map); });
    return layer;
  }

  function render() {
    group.clearLayers();
    for (const n of items) { const l = build(n); if (l) group.addLayer(l); }
    $("noteCount").textContent = String(items.length);
  }
  notes.subscribe(render);

  function drawDraft() {
    draft.clearLayers();
    if (!pts.length || !tool) return;
    const style = { color, weight: 3, opacity: 0.8, dashArray: "5 5" };
    if (tool === "poly" && pts.length > 2) draft.addLayer(L.polygon(pts, { ...style, fillOpacity: 0.1 }));
    else if (tool === "circle" && pts.length === 2) draft.addLayer(L.circle(pts[0], { ...style, radius: map.distance(pts[0], pts[1]) }));
    else draft.addLayer(L.polyline(pts, style));
    pts.forEach((p) => draft.addLayer(L.circleMarker(p, { radius: 4, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })));
  }

  function add(n: Omit<Note, "id" | "color">) {
    const note: Note = { ...n, id: uid(), color };
    items.push(note); save(); render();
    return note;
  }

  function finish() {
    if (tool === "line" && pts.length >= 2) add({ type: "line", pts });
    else if (tool === "poly" && pts.length >= 3) add({ type: "poly", pts });
    pts = []; draft.clearLayers();
  }

  map.on("click", (e: L.LeafletMouseEvent) => {
    if (!tool || tool === "pen") return;
    const p: LL = [e.latlng.lat, e.latlng.lng];
    if (tool === "pin" || tool === "text") {
      const n = add({ type: tool, pts: [p], text: "" });
      L.popup({ closeButton: false }).setLatLng(p).setContent(popupFor(n)).openOn(map);
      return;
    }
    if (tool === "circle") {
      pts.push(p);
      if (pts.length === 2) { add({ type: "circle", pts: [pts[0]], radius: map.distance(pts[0], pts[1]) }); pts = []; }
    } else {
      pts.push(p);
    }
    drawDraft();
  });
  map.on("dblclick", () => { if (tool === "line" || tool === "poly") { pts.pop(); finish(); } });
  map.on("mousemove", (e: L.LeafletMouseEvent) => {
    if (!tool || !pts.length || tool === "pen") return;
    const keep = pts;
    pts = [...keep, [e.latlng.lat, e.latlng.lng]];
    drawDraft();
    pts = keep;
  });
  document.addEventListener("keydown", (e) => {
    if (!tool) return;
    if (e.key === "Enter") finish();
    if (e.key === "Escape") { pts = []; draft.clearLayers(); }
  });

  // freehand
  const cont = map.getContainer();
  cont.addEventListener("pointerdown", (e) => {
    if (tool !== "pen" || (e.target as HTMLElement).closest(".leaflet-control")) return;
    penDown = true; pts = [];
    cont.setPointerCapture(e.pointerId);
    const ll = map.mouseEventToLatLng(e); pts.push([ll.lat, ll.lng]);
  });
  cont.addEventListener("pointermove", (e) => {
    if (!penDown) return;
    const ll = map.mouseEventToLatLng(e);
    const last = pts[pts.length - 1];
    const a = map.latLngToContainerPoint(last), b = map.latLngToContainerPoint(ll);
    if (a.distanceTo(b) > 3) { pts.push([ll.lat, ll.lng]); drawDraft(); }
  });
  const endPen = () => {
    if (!penDown) return;
    penDown = false;
    if (pts.length > 2) add({ type: "pen", pts });
    pts = []; draft.clearLayers();
  };
  cont.addEventListener("pointerup", endPen);
  cont.addEventListener("pointercancel", endPen);

  // ---- buttons ----
  $("noteUndo").addEventListener("click", () => {
    if (pts.length) { pts.pop(); drawDraft(); } else if (items.length) { items.pop(); save(); render(); }
  });
  $("noteFinish").addEventListener("click", finish);
  $("noteClear").addEventListener("click", () => {
    if (!items.length) return;
    if (confirm(`Delete all ${items.length} drawings?`)) { items = []; save(); render(); }
  });
  function toggleVisible() {
    visible = !visible;
    if (visible) group.addTo(map); else map.removeLayer(group);
    $("noteVisible").textContent = visible ? "Hide" : "Show";
  }
  $("noteVisible").addEventListener("click", toggleVisible);
  render();
  return { setTool };
}

// ---- Screenshot ----
export interface ShotInfo { caption: string }

export async function captureMap(map: L.Map, info: ShotInfo): Promise<Blob> {
  const box0 = map.getContainer();
  const box = box0.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bar = 34;
  const W = Math.round(box.width), H = Math.round(box.height);
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr; canvas.height = (H + bar) * dpr;
  const c = canvas.getContext("2d")!;
  c.scale(dpr, dpr);
  c.fillStyle = "#0e1116"; c.fillRect(0, 0, W, H + bar);
  c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();

  // tile layers in DOM (= stacking) order
  const layers = map.getContainer().querySelectorAll<HTMLElement>(".leaflet-tile-pane .leaflet-layer");
  layers.forEach((layer) => {
    const alpha = layer.style.opacity === "" ? 1 : parseFloat(layer.style.opacity);
    const side = layer.dataset.side, splitX = parseFloat(box0.dataset.cmpX ?? "");
    const clipped = !!side && Number.isFinite(splitX);
    if (clipped) { c.save(); c.beginPath(); c.rect(side === "l" ? 0 : splitX, 0, side === "l" ? splitX : W - splitX, H); c.clip(); }
    layer.querySelectorAll<HTMLImageElement>("img.leaflet-tile-loaded").forEach((img) => {
      const r = img.getBoundingClientRect();
      if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) return;
      c.globalAlpha = alpha;
      c.filter = getComputedStyle(img).filter;
      c.drawImage(img, r.left - box.left, r.top - box.top, r.width, r.height);
    });
    if (clipped) c.restore();
  });
  c.globalAlpha = 1; c.filter = "none";
  const sx = parseFloat(box0.dataset.cmpX ?? "");
  if (Number.isFinite(sx)) { c.fillStyle = "#fff"; c.fillRect(sx - 1, 0, 2, H); }

  // canvas overlays (feature finder)
  map.getContainer().querySelectorAll<HTMLCanvasElement>(".leaflet-overlay-pane canvas").forEach((cv) => {
    const r = cv.getBoundingClientRect();
    c.drawImage(cv, r.left - box.left, r.top - box.top, r.width, r.height);
  });

  // drawings, redrawn from data so labels and pins survive
  const P = (p: LL) => map.latLngToContainerPoint(p);
  c.lineCap = "round"; c.lineJoin = "round";
  const tag = (txt: string, x: number, y: number, col = "#fff") => {
    c.font = "600 12px system-ui, sans-serif";
    const w = c.measureText(txt).width + 12;
    c.fillStyle = "rgba(15,23,32,0.82)";
    c.beginPath(); c.roundRect(x - w / 2, y - 11, w, 22, 6); c.fill();
    c.fillStyle = col; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, x, y + 1);
  };
  for (const n of items) {
    c.strokeStyle = n.color; c.fillStyle = n.color; c.lineWidth = 3;
    if (n.type === "pin") {
      const p = P(n.pts[0]);
      c.beginPath(); c.arc(p.x, p.y, 7, 0, 7); c.fill(); c.lineWidth = 2.5; c.strokeStyle = "#fff"; c.stroke();
      if (n.text) tag(n.text, p.x, p.y - 20);
    } else if (n.type === "text") {
      const p = P(n.pts[0]); tag(n.text || "Text", p.x, p.y, n.color);
    } else if (n.type === "circle") {
      const p = P(n.pts[0]);
      const dLon = (n.radius ?? 0) / (111320 * Math.cos((n.pts[0][0] * Math.PI) / 180));
      const e = P([n.pts[0][0], n.pts[0][1] + dLon]);
      const r = Math.abs(e.x - p.x);
      c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.globalAlpha = 0.12; c.fill(); c.globalAlpha = 1; c.stroke();
      tag(label(map, n), p.x, p.y);
    } else {
      c.beginPath();
      n.pts.forEach((q, i) => { const p = P(q); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); });
      if (n.type === "poly") { c.closePath(); c.globalAlpha = 0.15; c.fill(); c.globalAlpha = 1; }
      c.stroke();
      if (n.type !== "pen") { const m = P(centroid(n.pts)); tag(label(map, n), m.x, m.y); }
    }
  }
  c.restore();

  // caption strip carries the attribution
  c.fillStyle = "#0e1116"; c.fillRect(0, H, W, bar);
  c.fillStyle = "#e5e7eb"; c.font = "12px system-ui, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle";
  c.fillText(info.caption, 12, H + bar / 2, W - 24);

  return new Promise((res, rej) => {
    try { canvas.toBlob((b) => (b ? res(b) : rej(new Error("empty image"))), "image/png"); }
    catch (e) { rej(e); }
  });
}
