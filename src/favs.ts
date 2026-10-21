import type { SourceId } from "./sources";

export interface Folder { id: string; name: string }
export interface Fav {
  id: string; folderId: string; name: string;
  lat: number; lon: number; zoom: number; source?: SourceId;
}
interface Data { folders: Folder[]; favs: Fav[] }

const KEY = "rsv.favs.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT: Data = {
  folders: [
    { id: "family", name: "Family" },
    { id: "interesting", name: "Interesting places" },
    { id: "travel", name: "Travel" },
  ],
  favs: [],
};

let data: Data = load();
const listeners = new Set<() => void>();

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.folders) && Array.isArray(d.favs)) return d;
    }
  } catch { /* storage unavailable */ }
  return structuredClone(DEFAULT);
}

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}

export const favs = {
  get folders() { return data.folders; },
  get items() { return data.favs; },
  subscribe(f: () => void) { listeners.add(f); },
  addFolder(name: string): Folder {
    const f = { id: uid(), name: name.trim() || "New folder" };
    data.folders.push(f); commit(); return f;
  },
  renameFolder(id: string, name: string) {
    const f = data.folders.find((x) => x.id === id);
    if (f && name.trim()) { f.name = name.trim(); commit(); }
  },
  /** Deleting a folder moves nothing: its places are deleted too. */
  deleteFolder(id: string) {
    data.folders = data.folders.filter((f) => f.id !== id);
    data.favs = data.favs.filter((p) => p.folderId !== id);
    commit();
  },
  add(p: Omit<Fav, "id">): Fav {
    const dup = data.favs.find((x) => x.folderId === p.folderId && Math.abs(x.lat - p.lat) < 1e-4 && Math.abs(x.lon - p.lon) < 1e-4);
    if (dup) return dup;
    const f = { ...p, id: uid() };
    data.favs.push(f); commit(); return f;
  },
  remove(id: string) { data.favs = data.favs.filter((p) => p.id !== id); commit(); },
  rename(id: string, name: string) {
    const p = data.favs.find((x) => x.id === id);
    if (p && name.trim()) { p.name = name.trim(); commit(); }
  },
  move(id: string, folderId: string) {
    const p = data.favs.find((x) => x.id === id);
    if (p && data.folders.some((f) => f.id === folderId)) { p.folderId = folderId; commit(); }
  },
  exportJson(): string { return JSON.stringify(data, null, 2); },
  importJson(text: string): number {
    const d = JSON.parse(text);
    if (!Array.isArray(d.folders) || !Array.isArray(d.favs)) throw new Error("Not a favourites file");
    const ids = new Set(data.folders.map((f) => f.id));
    for (const f of d.folders) if (f?.id && f?.name && !ids.has(f.id)) data.folders.push({ id: String(f.id), name: String(f.name) });
    let n = 0;
    for (const p of d.favs) {
      if (typeof p?.lat === "number" && typeof p?.lon === "number" && data.folders.some((f) => f.id === p.folderId)) {
        const before = data.favs.length;
        favs.add({ folderId: p.folderId, name: String(p.name ?? "Place"), lat: p.lat, lon: p.lon, zoom: Number(p.zoom) || 12, source: p.source });
        if (data.favs.length > before) n++;
      }
    }
    commit();
    return n;
  },
};
