// =====================================================================
//  Die ganze Seite neu zeichnen
//  render() rechnet alles aus den Spieltagen neu aus und baut danach die
//  einzelnen Bereiche auf. Jeder Bereich hat seine eigene Funktion.
// =====================================================================
import { el } from "../kern/dom.js";
import { state, gh, punkte, setRenderer } from "../kern/zustand.js";
import { resolveDay } from "../auswertung/spieltag.js";
import { computeStandings } from "../auswertung/tabelle.js";
import { computeElo, eloStartFor } from "../auswertung/elo.js";
import { seasonModus, modusText, bestOf, legsToWin } from "../auswertung/modus.js";
import { startDayIdx, setDayHash, dayNr, isPinnedDay } from "./navigation.js";
import { renderStandings, playedDays, previousRanks } from "./tabelle.js";
import { renderSeasonFinal } from "./saisonfinale.js";
import { dayView } from "./spieltag.js";
import { renderNextMatch } from "./naechstes-spiel.js";
import { renderFooter } from "./fusszeile.js";
import { renderSeasonBar } from "./saisonauswahl.js";
import { renderEditBar } from "../bearbeiten/leiste.js";
import { addDay } from "../bearbeiten/eingabe.js";

export function initPage() {
  setRenderer(renderPage);
}

function renderPage() {
  const hScroll = saveHScroll();
  const warnings = [];
  const resolved = state.days.map(function (d) { return resolveDay(d, warnings); });
  state.resolved = resolved;
  state.elo = computeElo(resolved, eloStartFor());
  document.body.classList.toggle("editing", state.editing);
  if (state.currentIdx === null || state.currentIdx >= state.days.length) state.currentIdx = startDayIdx();

  const standings = computeStandings(resolved);
  state.rows = standings.rows;
  const played = playedDays(resolved);
  renderStandings(standings, previousRanks(resolved, played));
  renderSeasonFinal(standings.rows, played.length);
  renderNameList(standings.rows);
  renderDayTabs(resolved);
  renderDay(resolved);
  renderHeader(resolved, standings.rows);
  renderPointsGrid();
  renderFormat();
  renderWarnings(warnings);
  renderEditBar();
  renderFooter();
  renderSeasonBar();
  renderNextMatch();

  restoreHScroll(hScroll);
  renderedDayIdx = state.currentIdx;
}

// Namensliste für die Eingabefelder im Bearbeiten-Modus
function renderNameList(rows) {
  const dl = document.getElementById("known-names");
  dl.innerHTML = "";
  rows.map(function (r) { return r.name; }).sort(function (a, b) { return a.localeCompare(b, "de"); })
    .forEach(function (n) { dl.appendChild(el("option", { value: n })); });
}

// Knöpfe „Spieltag 1“, „Spieltag 2“, …
function renderDayTabs(resolved) {
  const tabs = document.getElementById("day-tabs");
  tabs.innerHTML = "";
  resolved.forEach(function (d, i) {
    tabs.appendChild(el("button", {
      type: "button", "aria-pressed": i === state.currentIdx ? "true" : "false",
      text: "Spieltag " + dayNr(d, i) + (state.editing && isPinnedDay(d.nr) ? " ★" : ""),
      onclick: function () { state.currentIdx = i; renderPage(); setDayHash(dayNr(d, i)); },
    }));
  });
  if (state.editing) {
    tabs.appendChild(el("button", { type: "button", text: "+ Neuer Spieltag", onclick: addDay }));
  }
}

function renderDay(resolved) {
  const view = document.getElementById("day-view");
  view.innerHTML = "";
  if (!resolved.length) {
    view.appendChild(el("div", { class: "card empty", text: state.editing ? "Noch keine Spieltage. Leg mit „+ Neuer Spieltag“ den ersten an." : "Noch keine Spieltage eingetragen." }));
  } else {
    view.appendChild(dayView(state.days[state.currentIdx], resolved[state.currentIdx]));
  }
}

// Name der Liga, Titel des Browser-Tabs, Zeile darunter
function renderHeader(resolved, rows) {
  const name = state.liga.name || "Liga";
  document.getElementById("liga-name").textContent = name;
  document.title = name + " – Tabelle & Spieltage";
  const played = resolved.filter(function (d) { return d.complete; }).length;
  document.getElementById("liga-sub").textContent =
    played + (played === 1 ? " Spieltag" : " Spieltage") + " abgeschlossen · " + rows.length + " Spieler";
}

// Punktetabelle im Abschnitt „Modus & Punkte“
function renderPointsGrid() {
  const grid = document.getElementById("pts-grid");
  grid.innerHTML = "";
  [["7–8 Spieler", punkte()], ["5–6 Spieler", punkte("gruppe")]].forEach(function (row) {
    grid.appendChild(el("div", null, [
      el("span", { class: "pts-title", text: row[0] }),
      el("div", { class: "pts-row" }, row[1].map(function (p, i) {
        return el("div", null, [el("b", { text: String(p) }), el("span", { text: "Platz " + (i + 1) })]);
      })),
    ]));
  });
}

// Spielformat der Saison im Abschnitt „Modus & Punkte“
function renderFormat() {
  const box = document.getElementById("spielformat");
  if (!box) return;
  const m = seasonModus(state.liga);
  box.textContent = modusText(m) + ", großes Finale " + bestOf(legsToWin(m, "Finale")) +
    ". An Spezial-Spieltagen kann der Modus abweichen (steht dann beim Spieltag).";
}

// Hinweise auf Fehler in den Daten
function renderWarnings(warnings) {
  if (state.loadError && !gh.connected) {
    warnings.unshift("Die Datei ergebnisse.js wurde nicht gefunden oder enthält einen Fehler (z. B. ein fehlendes Komma oder Anführungszeichen).");
  }
  const wbox = document.getElementById("warnings");
  wbox.innerHTML = "";
  if (warnings.length) {
    wbox.appendChild(el("div", { class: "warn" }, [
      el("strong", { text: "Bitte prüfen:" }),
      el("ul", null, warnings.map(function (w) { return el("li", { text: w }); })),
    ]));
  }
}

// ---------------------------------------------------------------------
//  Seitliche Wisch-Position (Handy) beim Neuzeichnen behalten
//  Sonst springt der Turnierbaum nach jeder Eingabe wieder zur ersten Runde.
// ---------------------------------------------------------------------
let renderedDayIdx = null;

function saveHScroll() {
  return {
    day: renderedDayIdx,
    items: Array.prototype.map.call(document.querySelectorAll(".rounds, .games"), function (x) {
      return { inDay: !!x.closest("#day-view"), left: x.scrollLeft };
    }),
  };
}

function restoreHScroll(keep) {
  const list = document.querySelectorAll(".rounds, .games");
  if (list.length !== keep.items.length) return;
  keep.items.forEach(function (it, i) {
    if (it.left && (!it.inDay || keep.day === state.currentIdx)) list[i].scrollLeft = it.left;
  });
}
