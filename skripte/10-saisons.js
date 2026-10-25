// =====================================================================
//  Liga-Seite – Saisonarchiv und Saisonwechsel
//
//  daten/ergebnisse.js      laufende Saison (wird bearbeitet)
//  daten/saisons.js         Liste der archivierten Saisons
//  daten/archiv/<id>.js     eine abgeschlossene Saison (gleiches Format)
// =====================================================================
"use strict";

const SEASON_INDEX_FILE = "daten/saisons.js";
const ARCHIVE_FOLDER = "daten/archiv/";

let SEASONS = (typeof SAISONS !== "undefined" && Array.isArray(SAISONS)) ? clone(SAISONS) : [];
let currentSeason = null;   // laufende Saison, solange ein Archiv angezeigt wird
let archiveView = null;     // { id, name } beim Anzeigen eines Archivs

function viewingArchive() { return !!archiveView; }

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

function setUrlSeason(id) {
  try {
    const u = new URL(location.href);
    if (id) u.searchParams.set("saison", id); else u.searchParams.delete("saison");
    history.replaceState(null, "", u.toString());
  } catch (e) { /* egal */ }
}

// ---------------------------------------------------------------------
//  Anzeigen: aktuelle Saison oder Archiv
// ---------------------------------------------------------------------
async function showSeason(id) {
  if (editing) return;
  if (!id) {
    if (currentSeason) { LIGA_DATA = currentSeason.liga; DAYS = currentSeason.days; }
    currentSeason = null; archiveView = null; currentIdx = null;
    setUrlSeason(null);
    render();
    return;
  }
  const s = SEASONS.filter(function (x) { return x.id === id; })[0];
  if (!s) return;
  try {
    const r = await fetch(s.datei, { cache: "no-cache" });
    if (!r.ok) throw new Error("Fehler " + r.status);
    const parsed = parseDataFile(await r.text());
    if (!parsed.tage) throw new Error("keine Spieltage");
    if (!archiveView) currentSeason = { liga: LIGA_DATA, days: DAYS };
    archiveView = { id: s.id, name: s.name };
    LIGA_DATA = clone(parsed.liga || { name: s.name });
    DAYS = clone(parsed.tage);
    currentIdx = null;
    setUrlSeason(s.id);
    render();
  } catch (e) {
    alert("Die Saison „" + s.name + "“ konnte nicht geladen werden." +
      (location.protocol === "file:" ? "\n\nArchive lassen sich nur über die Website öffnen, nicht per Doppelklick auf index.html." : ""));
    renderSeasonBar();
  }
}

// Saisonauswahl und Archiv-Hinweis im Kopf der Seite
function renderSeasonBar() {
  let bar = document.getElementById("season-bar");
  if (!bar) {
    bar = el("div", { id: "season-bar", class: "season-bar" });
    const sub = document.getElementById("liga-sub");
    sub.parentNode.insertBefore(bar, sub.nextSibling);
  }
  bar.innerHTML = "";
  if (!SEASONS.length && !archiveView) { bar.hidden = true; return; }
  bar.hidden = false;

  const currentName = (archiveView && currentSeason ? currentSeason.liga.name : LIGA_DATA.name) || "Aktuelle Saison";
  const sel = el("select", { class: "cmp-select", "aria-label": "Saison wählen", disabled: editing ? "disabled" : null },
    [el("option", { value: "", text: currentName + " (aktuell)", selected: !archiveView ? "selected" : null })].concat(
      SEASONS.slice().reverse().map(function (s) {
        return el("option", { value: s.id, text: s.name, selected: archiveView && archiveView.id === s.id ? "selected" : null });
      })));
  sel.addEventListener("change", function () { showSeason(sel.value); });
  bar.appendChild(el("label", { class: "season-label" }, [el("span", { text: "Saison" }), sel]));

  if (archiveView) {
    bar.appendChild(el("div", { class: "archive-banner" }, [
      el("span", { text: "📁 Archiv – diese Saison ist abgeschlossen und kann nicht mehr bearbeitet werden." }),
      el("button", { type: "button", class: "linkbtn", text: "Zur aktuellen Saison ›", onclick: function () { showSeason(""); } }),
    ]));
  }
}

// ---------------------------------------------------------------------
//  Saisonwechsel (Bearbeiten-Modus, mit GitHub-Verbindung)
// ---------------------------------------------------------------------
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

function openSeasonEnd() {
  if (!gh.connected) { alert("Für den Saisonwechsel muss die Seite mit GitHub verbunden sein."); return; }
  if (dirty) { alert("Bitte zuerst die ungespeicherten Änderungen speichern."); return; }
  const dlg = getDialog("season-dialog");
  dlg.innerHTML = "";
  const oldIn = el("input", { type: "text", value: LIGA_DATA.name || "" });
  const idIn = el("input", { type: "text", value: seasonIdFromName(LIGA_DATA.name), autocomplete: "off" });
  const newIn = el("input", { type: "text", value: nextSeasonName(LIGA_DATA.name) });
  const msg = el("p", { class: "status", text: "" });
  oldIn.addEventListener("input", function () { idIn.value = seasonIdFromName(oldIn.value); newIn.value = nextSeasonName(oldIn.value); });
  const played = lastResolved.filter(function (d) { return d.complete; }).length;

  dlg.appendChild(el("div", { class: "pc admin" }, [
    el("div", { class: "pc-head" }, [
      el("h2", { text: "Saison abschließen" }),
      el("button", { type: "button", class: "btn close", text: "✕", "aria-label": "Schließen", onclick: function () { dlg.close(); } }),
    ]),
    el("p", { text: "Die laufende Saison (" + DAYS.length + " Spieltage, davon " + played + " abgeschlossen) wird archiviert und bleibt über die Saisonauswahl abrufbar. Danach beginnt eine leere neue Saison mit denselben Punkte- und Bonusregeln." }),
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
  if (SEASONS.some(function (s) { return s.id === id; })) { setMsg(msg, "Eine Saison mit dem Kürzel „" + id + "“ gibt es schon im Archiv.", "err"); return; }
  if (!confirm("„" + oldName + "“ wirklich abschließen und „" + newName + "“ beginnen?")) return;

  try {
    // Sicherstellen, dass niemand inzwischen gespeichert hat
    setMsg(msg, "Prüfe den aktuellen Stand …");
    const g = await fetch(apiUrl() + "?ref=" + encodeURIComponent(gh.branch), { headers: apiHeaders(), cache: "no-store" });
    if (!g.ok) throw new Error("Der aktuelle Stand konnte nicht geladen werden (Fehler " + g.status + ").");
    if ((await g.json()).sha !== gh.sha) throw new Error("Inzwischen hat jemand anderes gespeichert. Bitte Seite neu laden, erneut anmelden und den Saisonwechsel wiederholen.");

    // 1. Laufende Saison archivieren
    setMsg(msg, "Archiviere „" + oldName + "“ …");
    const keep = LIGA_DATA;
    const archLiga = clone(LIGA_DATA); archLiga.name = oldName;
    LIGA_DATA = archLiga;
    const archiveText = serialize();
    LIGA_DATA = keep;
    const file = ARCHIVE_FOLDER + id + ".js";
    await putFile(file, archiveText, "Saison „" + oldName + "“ archiviert");

    // 2. Saisonliste ergänzen
    setMsg(msg, "Trage die Saison ins Archiv ein …");
    const list = SEASONS.concat([{ id: id, name: oldName, datei: file, archiviert: new Date().toLocaleDateString("de-DE") }]);
    await putFile(SEASON_INDEX_FILE, seasonIndexText(list), "Archivliste ergänzt: " + oldName);
    SEASONS = list;

    // 3. Neue, leere Saison beginnen (Punkte und Bonusregeln bleiben)
    setMsg(msg, "Beginne „" + newName + "“ …");
    const newLiga = { name: newName, punkte: punkte().slice() };
    if (LIGA_DATA.bonus) newLiga.bonus = clone(LIGA_DATA.bonus);
    LIGA_DATA = newLiga;
    DAYS = [];
    const sha = await putFile(DATA_FILE, serialize(), "Neue Saison: " + newName);
    if (sha) gh.sha = sha;
    gitBase = snapshot();
    dirty = false;
    currentIdx = null;
    statusText = "„" + oldName + "“ ist archiviert, „" + newName + "“ hat begonnen. In etwa einer Minute sehen alle die neue Saison.";
    statusKind = "ok";
    getDialog("season-dialog").close();
    render();
  } catch (e) {
    setMsg(msg, (e && e.message) ? e.message : "Saisonwechsel fehlgeschlagen.", "err");
  }
}

// ---------------------------------------------------------------------
//  Start: Saisonauswahl anzeigen, ggf. Archiv aus dem Link öffnen
// ---------------------------------------------------------------------
getDialog("season-dialog").addEventListener("click", function (e) {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
renderSeasonBar();
(function () {
  let id = null;
  try { id = new URL(location.href).searchParams.get("saison"); } catch (e) { /* egal */ }
  if (id && SEASONS.some(function (s) { return s.id === id; })) showSeason(id);
})();