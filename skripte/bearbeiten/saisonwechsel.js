// =====================================================================
//  Saison abschließen (Bearbeiten-Modus, mit GitHub-Verbindung)
//  1. laufende Saison nach daten/archiv/<id>.js kopieren
//  2. in daten/saisons.js eintragen
//  3. ergebnisse.js mit einer leeren neuen Saison überschreiben
// =====================================================================
import { DATA_FILE, ARCHIVE_FOLDER, SEASON_INDEX_FILE } from "../kern/konstanten.js";
import { el, getDialog, openDialog, closeButton, setMsg } from "../kern/dom.js";
import { clone } from "../kern/hilfen.js";
import { state, gh, punkte, render } from "../kern/zustand.js";
import { rebuildEloChain } from "../auswertung/elo.js";
import { serialize } from "./datei.js";
import { getFile, putFile } from "./github.js";
import { snapshot } from "./zusammenfuehren.js";

// "Liga 2026/27" -> "2026-27"
function seasonIdFromName(name) {
  const m = String(name || "").match(/(\d{4})\s*[\/\-–]\s*(\d{2,4})/);
  if (m) return m[1] + "-" + m[2].slice(-2);
  const y = String(name || "").match(/\d{4}/);
  return y ? y[0] : String(new Date().getFullYear());
}

// "Liga 2026/27" -> "Liga 2027/28"
function nextSeasonName(name) {
  const s = String(name || "Liga");
  const m = s.match(/(\d{4})(\s*[\/\-–]\s*)(\d{2,4})/);
  if (m) {
    const a = Number(m[1]) + 1, b = Number(m[3]) + 1;
    const bStr = m[3].length === 2 ? String(b % 100).padStart(2, "0") : String(b);
    return s.replace(m[0], a + m[2] + bStr);
  }
  const y = s.match(/\d{4}/);
  return y ? s.replace(y[0], String(Number(y[0]) + 1)) : s + " (neu)";
}

// Neuer Inhalt für daten/saisons.js
function seasonIndexText(list) {
  return [
    "// =====================================================================",
    "//  ARCHIV – abgeschlossene Saisons",
    "//  Wird beim Saisonwechsel auf der Website automatisch ergänzt.",
    "//  datei: Pfad zur archivierten Saison (gleiches Format wie ergebnisse.js)",
    "// =====================================================================",
    "",
    "const SAISONS = [",
  ].concat(list.map(function (s) {
    return "  { id: " + JSON.stringify(s.id) + ", name: " + JSON.stringify(s.name) +
      ", datei: " + JSON.stringify(s.datei) + (s.archiviert ? ", archiviert: " + JSON.stringify(s.archiviert) : "") + " },";
  })).concat(["];", ""]).join("\n");
}

export function openSeasonEnd() {
  if (!gh.connected) { alert("Für den Saisonwechsel muss die Seite mit GitHub verbunden sein."); return; }
  if (state.dirty) { alert("Bitte zuerst die ungespeicherten Änderungen speichern."); return; }
  const dlg = getDialog("season-dialog");
  dlg.innerHTML = "";
  const oldIn = el("input", { type: "text", value: state.liga.name || "" });
  const idIn = el("input", { type: "text", value: seasonIdFromName(state.liga.name), autocomplete: "off" });
  const newIn = el("input", { type: "text", value: nextSeasonName(state.liga.name) });
  const msg = el("p", { class: "status", text: "" });
  oldIn.addEventListener("input", function () { idIn.value = seasonIdFromName(oldIn.value); newIn.value = nextSeasonName(oldIn.value); });
  const played = state.resolved.filter(function (d) { return d.complete; }).length;

  dlg.appendChild(el("div", { class: "pc admin" }, [
    el("div", { class: "pc-head" }, [
      el("h2", { text: "Saison abschließen" }),
      closeButton(dlg),
    ]),
    el("p", { text: "Die laufende Saison (" + state.days.length + " Spieltage, davon " + played + " abgeschlossen) wird archiviert und bleibt über die Saisonauswahl abrufbar. Danach beginnt eine leere neue Saison mit denselben Punkte-, Bonus- und Modusregeln." }),
    el("label", { class: "field" }, [document.createTextNode("Name der abgeschlossenen Saison"), oldIn]),
    el("label", { class: "field" }, [document.createTextNode("Kürzel (wird Dateiname und Link, z. B. 2026-27)"), idIn]),
    el("label", { class: "field" }, [document.createTextNode("Name der neuen Saison"), newIn]),
    el("div", { class: "row" }, [
      el("button", { class: "btn primary", type: "button", text: "Saison abschließen", onclick: function () {
        closeSeason(oldIn.value.trim(), idIn.value.trim(), newIn.value.trim(), msg);
      } }),
      el("button", { class: "btn", type: "button", text: "Abbrechen", onclick: function () { dlg.close(); } }),
    ]),
    msg,
  ]));
  openDialog(dlg);
}

async function closeSeason(oldName, id, newName, msg) {
  if (!oldName || !newName) { setMsg(msg, "Bitte beide Namen eintragen.", "err"); return; }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) { setMsg(msg, "Das Kürzel darf nur Buchstaben, Zahlen und Bindestriche enthalten.", "err"); return; }
  if (state.seasons.some(function (s) { return s.id === id; })) { setMsg(msg, "Eine Saison mit dem Kürzel „" + id + "“ gibt es schon im Archiv.", "err"); return; }
  if (!confirm("„" + oldName + "“ wirklich abschließen und „" + newName + "“ beginnen?")) return;

  try {
    // Sicherstellen, dass niemand inzwischen gespeichert hat
    setMsg(msg, "Prüfe den aktuellen Stand …");
    const g = await getFile(DATA_FILE);
    if (!g.ok) throw new Error("Der aktuelle Stand konnte nicht geladen werden (Fehler " + g.status + ").");
    if ((await g.json()).sha !== gh.sha) throw new Error("Inzwischen hat jemand anderes gespeichert. Bitte Seite neu laden, erneut anmelden und den Saisonwechsel wiederholen.");

    // 1. Laufende Saison archivieren
    setMsg(msg, "Archiviere „" + oldName + "“ …");
    const archLiga = clone(state.liga); archLiga.name = oldName;
    const file = ARCHIVE_FOLDER + id + ".js";
    await putFile(file, serialize(archLiga, state.days), "Saison „" + oldName + "“ archiviert");

    // 2. Saisonliste ergänzen
    setMsg(msg, "Trage die Saison ins Archiv ein …");
    const list = state.seasons.concat([{ id: id, name: oldName, datei: file, archiviert: new Date().toLocaleDateString("de-DE") }]);
    await putFile(SEASON_INDEX_FILE, seasonIndexText(list), "Archivliste ergänzt: " + oldName);
    state.seasons = list;

    // 3. Neue, leere Saison beginnen (Punkte, Bonus und Spielmodus bleiben)
    setMsg(msg, "Beginne „" + newName + "“ …");
    const newLiga = { name: newName, punkte: punkte().slice() };
    if (Array.isArray(state.liga.punkteKlein)) newLiga.punkteKlein = state.liga.punkteKlein.slice();
    if (state.liga.bonus) newLiga.bonus = clone(state.liga.bonus);
    if (state.liga.modus) newLiga.modus = clone(state.liga.modus);
    state.archives[id] = clone(state.days);
    state.liga = newLiga;
    state.days = [];
    rebuildEloChain();
    const sha = await putFile(DATA_FILE, serialize(state.liga, state.days), "Neue Saison: " + newName);
    if (sha) gh.sha = sha;
    state.gitBase = snapshot();
    state.dirty = false;
    state.currentIdx = null;
    state.statusText = "„" + oldName + "“ ist archiviert, „" + newName + "“ hat begonnen. In etwa einer Minute sehen alle die neue Saison.";
    state.statusKind = "ok";
    getDialog("season-dialog").close();
    render();
  } catch (e) {
    setMsg(msg, (e && e.message) ? e.message : "Saisonwechsel fehlgeschlagen.", "err");
  }
}
