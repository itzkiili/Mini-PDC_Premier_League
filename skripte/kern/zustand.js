// =====================================================================
//  Zustand der Seite
//  Alles, was sich während der Nutzung ändert, steht in `state`.
//  Andere Dateien lesen und ändern es nur über dieses Objekt.
// =====================================================================
import { DEFAULT_PUNKTE } from "./konstanten.js";
import { clone } from "./hilfen.js";
import { geladen } from "./daten.js";

const loadError = geladen.tage === undefined;

export const state = {
  // ---------- Daten der angezeigten Saison ----------
  liga: clone(geladen.liga || { name: "Liga", punkte: DEFAULT_PUNKTE }),
  days: clone(!loadError && Array.isArray(geladen.tage) ? geladen.tage : []),
  loadError: loadError,          // ergebnisse.js fehlt oder ist fehlerhaft

  // ---------- Ergebnis der letzten Berechnung (render) ----------
  resolved: [],                  // ausgewertete Spieltage
  rows: [],                      // Gesamttabelle
  elo: {},                       // Elo-Werte nach dem letzten Spieltag

  // ---------- Anzeige ----------
  currentIdx: null,              // geöffneter Spieltag (Index in days)

  // ---------- Bearbeiten-Modus ----------
  editing: false,
  dirty: false,                  // ungespeicherte Änderungen
  saving: false,
  statusText: "",
  statusKind: "",                // "", "ok" oder "err"
  gitBase: null,                 // Stand beim letzten Laden/Speichern (zum Zusammenführen)

  // ---------- Saisons ----------
  seasons: clone(geladen.saisons),
  archives: {},                  // geladene Spieltage archivierter Saisons, nach id
  archiveView: null,             // { id, name }, solange ein Archiv angezeigt wird
  currentSeason: null,           // laufende Saison, solange ein Archiv angezeigt wird
  eloChain: { bySeason: {}, current: null },   // Elo-Stand zu Beginn jeder Saison

  // ---------- Spielerprofile ----------
  profiles: clone(geladen.spieler),
  profilePreview: {},            // frisch hochgeladene Bilder, bis GitHub Pages sie ausliefert
};

// Verbindung zu GitHub (Bearbeiten-Modus)
export const gh = { repo: "", branch: "main", token: "", sha: null, connected: false };

export function viewingArchive() { return !!state.archiveView; }

// Punkte pro Platz; mode "gruppe" = Spieltag mit 5–6 Spielern.
// Fehlt punkteKlein (z. B. in alten Saisons), gilt die normale Liste.
// liga (optional): andere Einstellungen als die der angezeigten Saison
export function punkte(mode, liga) {
  liga = liga || state.liga;
  const gross = Array.isArray(liga.punkte) ? liga.punkte : DEFAULT_PUNKTE;
  if (mode === "gruppe") return Array.isArray(liga.punkteKlein) ? liga.punkteKlein : gross;
  return gross;
}

// Bonuspunkte laut Liga-Einstellung
export function bonusCfg(liga) {
  const b = (liga || state.liga).bonus || {};
  const n = function (v, d) { const x = Number(v); return isFinite(x) ? x : d; };
  return { checkout: n(b.checkout, 1), leg: n(b.leg, 1), je180: n(b.je180, 1) };
}

// Name der angezeigten Saison
export function currentSeasonLabel() {
  return state.archiveView ? state.archiveView.name : (state.liga.name || "Aktuelle Saison");
}

// ---------------------------------------------------------------------
//  Neu zeichnen
//  Die Seite meldet ihre Zeichenfunktion hier an (anzeige/seite.js).
//  So können alle Dateien render() aufrufen, ohne die Anzeige zu kennen.
// ---------------------------------------------------------------------
let renderer = function () {};
export function setRenderer(fn) { renderer = fn; }
export function render() { renderer(); }

// Nach jeder Eingabe im Bearbeiten-Modus
export function changed() {
  state.dirty = true;
  state.statusText = "Ungespeicherte Änderungen";
  state.statusKind = "";
  render();
}
