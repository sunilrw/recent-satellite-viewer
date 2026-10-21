import type { Ctx } from "./ctx";
import { el } from "./ctx";
import { favs, type Fav } from "./favs";
import { COLLECTIONS } from "./collections";
import { parseLocation } from "./location";
import { sourceById } from "./sources";

export function initSaved(ctx: Ctx) {
  const root = el("folders");
  const form = el("saveForm"), nameIn = el<HTMLInputElement>("saveName"), folderSel = el<HTMLSelectElement>("saveFolder");
  const collapsed = new Set<string>();

  function openForm(name?: string) {
    nameIn.value = name ?? ctx.lastName().split(",")[0] ?? "";
    folderSel.textContent = "";
    for (const f of favs.folders) folderSel.append(new Option(f.name, f.id));
    folderSel.append(new Option("＋ New folder…", "__new"));
    form.hidden = false;
    ctx.showTab("saved");
    nameIn.focus(); nameIn.select();
  }
  el("saveHere").addEventListener("click", () => openForm());
  el("star").addEventListener("click", () => openForm());
  el("saveCancel").addEventListener("click", () => (form.hidden = true));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let folderId = folderSel.value;
    if (folderId === "__new") {
      const n = prompt("New folder name");
      if (!n) return;
      folderId = favs.addFolder(n).id;
    }
    const c = ctx.map.getCenter();
    favs.add({ folderId, name: nameIn.value.trim() || "Saved place", lat: c.lat, lon: c.lng, zoom: Math.round(ctx.map.getZoom()), source: ctx.currentSource() });
    form.hidden = true;
    ctx.toast("Saved");
  });
  el("newFolder").addEventListener("click", () => {
    const n = prompt("Folder name (e.g. Family)");
    if (n) favs.addFolder(n);
  });

  function row(p: Fav): HTMLElement {
    const li = document.createElement("li");
    li.className = "fav"; li.draggable = true; li.dataset.id = p.id;
    const go = document.createElement("button");
    go.className = "favgo";
    const n = document.createElement("strong"); n.textContent = p.name;
    const m = document.createElement("span"); m.textContent = `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}${p.source ? " · " + sourceById(p.source).name : ""}`;
    go.append(n, m);
    go.addEventListener("click", () => ctx.goTo({ lat: p.lat, lon: p.lon, zoom: p.zoom, name: p.name, source: p.source }));
    const ren = iconBtn("✎", "Rename", () => { const v = prompt("Rename", p.name); if (v) favs.rename(p.id, v); });
    const del = iconBtn("✕", "Remove", () => favs.remove(p.id));
    li.append(go, ren, del);
    li.addEventListener("dragstart", (e) => { e.dataTransfer?.setData("text/plain", p.id); li.classList.add("drag"); });
    li.addEventListener("dragend", () => li.classList.remove("drag"));
    return li;
  }

  function iconBtn(txt: string, label: string, fn: () => void) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "icon sm"; b.textContent = txt; b.title = label; b.setAttribute("aria-label", label);
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    return b;
  }

  function render() {
    root.textContent = "";
    for (const f of favs.folders) {
      const items = favs.items.filter((p) => p.folderId === f.id);
      const box = document.createElement("section"); box.className = "folder";
      const head = document.createElement("div"); head.className = "fhead";
      const t = document.createElement("button"); t.className = "ftitle";
      t.textContent = `${collapsed.has(f.id) ? "▸" : "▾"} ${f.name}`;
      const cnt = document.createElement("small"); cnt.textContent = String(items.length); t.append(cnt);
      t.addEventListener("click", () => { collapsed.has(f.id) ? collapsed.delete(f.id) : collapsed.add(f.id); render(); });
      head.append(t,
        iconBtn("✎", "Rename folder", () => { const v = prompt("Rename folder", f.name); if (v) favs.renameFolder(f.id, v); }),
        iconBtn("🗑", "Delete folder", () => { if (!items.length || confirm(`Delete “${f.name}” and its ${items.length} places?`)) favs.deleteFolder(f.id); }));
      box.append(head);
      if (!collapsed.has(f.id)) {
        const ul = document.createElement("ul");
        if (!items.length) { const e = document.createElement("li"); e.className = "empty"; e.textContent = "Drop places here or save the current view."; ul.append(e); }
        items.forEach((p) => ul.append(row(p)));
        box.append(ul);
      }
      box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("over"); });
      box.addEventListener("dragleave", () => box.classList.remove("over"));
      box.addEventListener("drop", (e) => { e.preventDefault(); box.classList.remove("over"); const id = e.dataTransfer?.getData("text/plain"); if (id) favs.move(id, f.id); });
      root.append(box);
    }
  }
  favs.subscribe(render);
  render();
  return { openForm };
}

export function initDiscover(ctx: Ctx) {
  const root = el("collections");
  const open = new Set<string>();
  function render() {
    root.textContent = "";
    for (const c of COLLECTIONS) {
      const card = document.createElement("section"); card.className = "coll";
      const head = document.createElement("button"); head.className = "chead";
      head.innerHTML = `<span class="emo">${c.emoji}</span>`;
      const tx = document.createElement("span"); tx.className = "ctx";
      const t = document.createElement("strong"); t.textContent = c.title;
      const s = document.createElement("small"); s.textContent = `${c.places.length} places · ${c.blurb}`;
      tx.append(t, s); head.append(tx);
      head.addEventListener("click", () => { open.has(c.id) ? open.delete(c.id) : open.add(c.id); render(); });
      card.append(head);
      if (open.has(c.id)) {
        const ul = document.createElement("ul");
        for (const p of c.places) {
          const li = document.createElement("li");
          const go = document.createElement("button"); go.className = "favgo";
          const n = document.createElement("strong"); n.textContent = p.name; go.append(n);
          if (p.note) { const m = document.createElement("span"); m.textContent = p.note; go.append(m); }
          go.addEventListener("click", () => ctx.goTo({
            lat: p.lat, lon: p.lon, zoom: p.zoom, name: p.name,
            ...(p.before && p.after ? { source: "s2" as const, compare: { before: p.before, after: p.after } } : {}),
          }));
          const add = document.createElement("button"); add.className = "icon sm"; add.textContent = "☆"; add.title = "Save to favourites";
          add.addEventListener("click", () => {
            let f = favs.folders.find((x) => x.name === c.title) ?? favs.addFolder(c.title);
            favs.add({ folderId: f.id, name: p.name, lat: p.lat, lon: p.lon, zoom: p.zoom });
            ctx.toast(`Saved to “${c.title}”`);
          });
          li.append(go);
          if (p.before) { const tag = document.createElement("small"); tag.className = "cmpTag"; tag.textContent = "⇄"; tag.title = "Before / after"; li.append(tag); }
          li.append(add); ul.append(li);
        }
        const all = document.createElement("button"); all.className = "ghost wide"; all.textContent = "Save whole group as a folder";
        all.addEventListener("click", () => {
          const f = favs.folders.find((x) => x.name === c.title) ?? favs.addFolder(c.title);
          c.places.forEach((p) => favs.add({ folderId: f.id, name: p.name, lat: p.lat, lon: p.lon, zoom: p.zoom }));
          ctx.toast(`Folder “${c.title}” saved`);
        });
        card.append(ul, all);
      }
      root.append(card);
    }
  }
  render();
}

export { parseLocation };
