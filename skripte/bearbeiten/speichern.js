// =====================================================================
//  Ergebnisse speichern: bei GitHub oder als Datei zum Herunterladen
// =====================================================================
import { DATA_FILE } from "../kern/konstanten.js";
import { el } from "../kern/dom.js";
import { b64encode, b64decode } from "../kern/hilfen.js";
import { parseDataFile } from "../kern/daten.js";
import { state, gh, render } from "../kern/zustand.js";
import { cleanupDay } from "../auswertung/spieltag.js";
import { serialize } from "./datei.js";
import { getFile, putContent } from "./github.js";
import { snapshot, flattenData, unflattenData, mergeData, conflictLabel } from "./zusammenfuehren.js";
import { setStatus, renderEditBar } from "./leiste.js";

export async function saveToGitHub() {
  if (!gh.connected || state.saving) return;
  state.saving = true;
  setStatus("Speichert …", "");
  let mergedInfo = null;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const now = new Date();
      state.liga.stand = now.toISOString();
      const message = "Ergebnisse aktualisiert (" + now.toLocaleDateString("de-DE") + " " + now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + ")";
      const sha = await putContent(DATA_FILE, b64encode(serialize(state.liga, state.days)), message, gh.sha);
      if (sha === null) {
        // Jemand anderes hat inzwischen gespeichert: zusammenführen und erneut versuchen
        setStatus("Jemand anderes hat gerade gespeichert – führe die Änderungen zusammen …", "");
        mergedInfo = await pullAndMerge();
        render();
        continue;
      }
      gh.sha = sha || gh.sha;
      state.gitBase = snapshot();
      state.dirty = false;
      state.statusText = mergedInfo
        ? "Gespeichert. Die gleichzeitigen Änderungen einer anderen Person wurden übernommen" + (mergedInfo.conflicts ? " (" + mergedInfo.conflicts + " Konflikt" + (mergedInfo.conflicts === 1 ? "" : "e") + " entschieden)." : ".")
        : "Gespeichert. In etwa einer Minute sehen alle den neuen Stand.";
      state.statusKind = "ok";
      state.saving = false;
      render();
      return;
    }
    throw new Error("Speichern ist mehrmals mit anderen Änderungen zusammengestoßen. Bitte gleich noch einmal auf Speichern drücken.");
  } catch (e) {
    state.statusText = (e && e.message) ? e.message : "Speichern fehlgeschlagen.";
    state.statusKind = "err";
  }
  state.saving = false;
  renderEditBar();
}

// Aktuellen Stand von GitHub holen und mit den eigenen Änderungen zusammenführen
async function pullAndMerge() {
  const r = await getFile(DATA_FILE);
  if (!r.ok) throw new Error("Der aktuelle Stand konnte nicht von GitHub geladen werden (Fehler " + r.status + ").");
  const j = await r.json();
  const parsed = parseDataFile(b64decode(j.content));
  const remote = { liga: parsed.liga || {}, days: parsed.tage || [] };
  const base = state.gitBase || remote;
  const res = mergeData(base, snapshot(), remote);
  if (res.conflicts.length) {
    const list = res.conflicts.slice(0, 12).map(function (c) { return "• " + conflictLabel(c.key); }).join("\n") +
      (res.conflicts.length > 12 ? "\n• … und " + (res.conflicts.length - 12) + " weitere" : "");
    const useMine = confirm("Jemand hat gleichzeitig dieselben Einträge anders gespeichert:\n\n" + list +
      "\n\nOK = deine Eingaben übernehmen\nAbbrechen = die Eingaben der anderen Person behalten");
    if (!useMine) res.conflicts.forEach(function (c) {
      if (c.remote === undefined) delete res.merged[c.key]; else res.merged[c.key] = c.remote;
    });
  }
  const data = unflattenData(res.merged);
  state.liga = data.liga;
  state.days = data.days;
  state.days.forEach(cleanupDay);
  gh.sha = j.sha;
  state.gitBase = remote;
  return { conflicts: res.conflicts.length, changedByOthers: JSON.stringify(flattenData(base)) !== JSON.stringify(res.R) };
}

export function downloadFile() {
  const blob = new Blob([serialize(state.liga, state.days)], { type: "text/javascript;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: "ergebnisse.js" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  setStatus("Datei heruntergeladen. Lade sie in GitHub hoch und ersetze damit die alte ergebnisse.js.", "ok");
}
