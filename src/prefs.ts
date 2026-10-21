import { favs } from "./favs";
import { notes } from "./annotate";

const KEY = "rsv.prefs.v1";

export interface Prefs { source?: string; days?: number; cloud?: number; opacity?: number; quick?: boolean }

export function loadPrefs(): Prefs {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export function savePrefs(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** Everything the user can lose: favourites, drawings, filter settings. */
export function exportAll(): string {
  return JSON.stringify({
    app: "recent-satellite-viewer", version: 1, exportedAt: new Date().toISOString(),
    prefs: loadPrefs(),
    favourites: JSON.parse(favs.exportJson()),
    annotations: notes.items,
  }, null, 2);
}

export function importAll(text: string): { favs: number; notes: number; prefs: boolean } {
  const d = JSON.parse(text);
  if (d?.app !== "recent-satellite-viewer") throw new Error("This is not a Recent Satellite Viewer backup");
  const f = d.favourites ? favs.importJson(JSON.stringify(d.favourites)) : 0;
  const n = Array.isArray(d.annotations) ? notes.importItems(d.annotations) : 0;
  if (d.prefs && typeof d.prefs === "object") savePrefs(d.prefs);
  return { favs: f, notes: n, prefs: !!d.prefs };
}

export function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
