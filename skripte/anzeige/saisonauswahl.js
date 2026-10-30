// =====================================================================
//  Saisonauswahl im Kopf der Seite und Anzeige archivierter Saisons
//
//  daten/ergebnisse.js      laufende Saison (wird bearbeitet)
//  daten/saisons.js         Liste der archivierten Saisons
//  daten/archiv/<id>.js     eine abgeschlossene Saison (gleiches Format)
// =====================================================================
import { el } from "../kern/dom.js";
import { clone } from "../kern/hilfen.js";
import { parseDataFile } from "../kern/daten.js";
import { state, render } from "../kern/zustand.js";
import { rebuildEloChain } from "../auswertung/elo.js";
import { renderWorldSection } from "./weltrangliste.js";

function setUrlSeason(id) {
  try {
    const u = new URL(location.href);
    if (id) u.searchParams.set("saison", id); else u.searchParams.delete("saison");
    history.replaceState(null, "", u.toString());
  } catch (e) { /* egal */ }
}

async function fetchSeason(s) {
  const r = await fetch(s.datei, { cache: "no-cache" });
  if (!r.ok) throw new Error("Fehler " + r.status);
  return parseDataFile(await r.text());
}

// Aktuelle Saison (id leer) oder ein Archiv anzeigen
export async function showSeason(id) {
  if (state.editing) return;
  if (!id) {
    if (state.currentSeason) { state.liga = state.currentSeason.liga; state.days = state.currentSeason.days; }
    state.currentSeason = null; state.archiveView = null; state.currentIdx = null;
    setUrlSeason(null);
    render();
    return;
  }
  const s = state.seasons.filter(function (x) { return x.id === id; })[0];
  if (!s) return;
  try {
    const parsed = await fetchSeason(s);
    if (!parsed.tage) throw new Error("keine Spieltage");
    if (!state.archiveView) state.currentSeason = { liga: state.liga, days: state.days };
    state.archiveView = { id: s.id, name: s.name };
    state.liga = clone(parsed.liga || { name: s.name });
    state.days = clone(parsed.tage);
    state.currentIdx = null;
    setUrlSeason(s.id);
    render();
  } catch (e) {
    alert("Die Saison „" + s.name + "“ konnte nicht geladen werden." +
      (location.protocol === "file:" ? "\n\nArchive lassen sich nur über die Website öffnen, nicht per Doppelklick auf index.html." : ""));
    renderSeasonBar();
  }
}

// Link mit ?saison=2025-26: diese Saison öffnen
export function showSeasonFromUrl() {
  let id = null;
  try { id = new URL(location.href).searchParams.get("saison"); } catch (e) { /* egal */ }
  if (id && state.seasons.some(function (s) { return s.id === id; })) showSeason(id);
}

// Saisonauswahl und Archiv-Hinweis unter der Überschrift
export function renderSeasonBar() {
  let bar = document.getElementById("season-bar");
  if (!bar) {
    bar = el("div", { id: "season-bar", class: "season-bar" });
    const sub = document.getElementById("liga-sub");
    sub.parentNode.insertBefore(bar, sub.nextSibling);
  }
  bar.innerHTML = "";
  if (!state.seasons.length && !state.archiveView) { bar.hidden = true; return; }
  bar.hidden = false;

  const currentName = (state.archiveView && state.currentSeason ? state.currentSeason.liga.name : state.liga.name) || "Aktuelle Saison";
  const sel = el("select", { class: "cmp-select", "aria-label": "Saison wählen", disabled: state.editing ? "disabled" : null },
    [el("option", { value: "", text: currentName + " (aktuell)", selected: !state.archiveView ? "selected" : null })].concat(
      state.seasons.slice().reverse().map(function (s) {
        return el("option", { value: s.id, text: s.name, selected: state.archiveView && state.archiveView.id === s.id ? "selected" : null });
      })));
  sel.addEventListener("change", function () { showSeason(sel.value); });
  bar.appendChild(el("label", { class: "season-label" }, [el("span", { text: "Saison" }), sel]));

  if (state.archiveView) {
    bar.appendChild(el("div", { class: "archive-banner" }, [
      el("span", { text: "📁 Archiv – diese Saison ist abgeschlossen und kann nicht mehr bearbeitet werden." }),
      el("button", { type: "button", class: "linkbtn", text: "Zur aktuellen Saison ›", onclick: function () { showSeason(""); } }),
    ]));
  }
}

// Alle Archive laden (klein, einmalig) und die Elo-Wertung über alle Saisons rechnen
export async function loadArchivesForElo() {
  if (!state.seasons.length) return;
  for (let i = 0; i < state.seasons.length; i++) {
    const s = state.seasons[i];
    if (state.archives[s.id]) continue;
    try {
      const parsed = await fetchSeason(s);
      if (parsed.tage) state.archives[s.id] = parsed.tage;
    } catch (e) {
      console.warn("Archiv „" + s.name + "“ konnte für die Elo-Wertung nicht geladen werden.", e);
    }
  }
  rebuildEloChain();
  if (!state.editing) render(); else renderWorldSection();
}
