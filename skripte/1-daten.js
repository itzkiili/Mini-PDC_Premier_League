// =====================================================================
//  Liga-Seite – Einstellungen, Daten und Zustand der Seite
// =====================================================================
"use strict";

// ===================================================================
//  Daten
// ===================================================================
// ------------------------------------------------------------------
//  Dateiname des Regelwerks im Repository (gleicher Ordner wie diese Seite).
//  Bei einem anderen Namen nur hier ändern, z. B. "Regelwerk_Liga.pdf".
// ------------------------------------------------------------------
const REGELWERK_PDF = "dokumente/Regelwerk.pdf";
document.querySelectorAll(".pdf-link").forEach(function (a) { a.setAttribute("href", encodeURI(REGELWERK_PDF)); });

const DATA_FILE = "daten/ergebnisse.js";
const DEFAULT_PUNKTE = [15, 13, 11, 9, 9, 7, 6, 5];   // 7–8 Spieler (Turnierbaum)
const DEFAULT_PUNKTE_KLEIN = [15, 13, 11, 9, 7, 6];    // 5–6 Spieler (Dreiergruppen) 
const loadError = typeof SPIELTAGE === "undefined";
let LIGA_DATA = clone(typeof LIGA !== "undefined" && LIGA ? LIGA : { name: "Liga", punkte: DEFAULT_PUNKTE });
let DAYS = clone(!loadError && Array.isArray(SPIELTAGE) ? SPIELTAGE : []);

function clone(x) { return JSON.parse(JSON.stringify(x)); }
// Punkte pro Platz; mode "gruppe" = Spieltag mit 5–6 Spielern.
// Fehlt punkteKlein (z. B. in alten Saisons), gilt die normale Liste.
function punkte(mode) {
  const gross = Array.isArray(LIGA_DATA.punkte) ? LIGA_DATA.punkte : DEFAULT_PUNKTE;
  if (mode === "gruppe") return Array.isArray(LIGA_DATA.punkteKlein) ? LIGA_DATA.punkteKlein : gross;
  return gross;
}
// Zustand des Bearbeiten-Modus
let editing = false;
let lastResolved = [];
let lastRows = [];
let lastElo = {};
// Elo-Wertung: Startwert und K-Faktor (wie stark ein einzelnes Spiel zählt)
const ELO_START = 1000;
const ELO_K = 40;

let dirty = false;
let currentIdx = null;
let statusText = "";
let statusKind = "";
let saving = false;
const gh = { repo: "", branch: "main", token: "", sha: null, connected: false };

const LABELS = {
  VF1: "Viertelfinale 1", VF2: "Viertelfinale 2", VF3: "Viertelfinale 3", VF4: "Viertelfinale 4",
  HF1: "Halbfinale 1", HF2: "Halbfinale 2", Finale: "Finale", P3: "Spiel um Platz 3",
  PR1: "Platzierungsrunde 1", PR2: "Platzierungsrunde 2", P5: "Spiel um Platz 5", P7: "Spiel um Platz 7",
  G1: "Gruppenspiel 1", G2: "Gruppenspiel 2", G3: "Gruppenspiel 3",
  V1: "Gruppenspiel 1", V2: "Gruppenspiel 2", V3: "Gruppenspiel 3",
};
const KEY_ORDER = ["VF1", "VF2", "VF3", "VF4", "PR1", "PR2", "HF1", "HF2", "P7", "P5", "P3", "Finale",
  "G1", "G2", "G3", "V1", "V2", "V3"];
const PLACE_OF = { Finale: [1, 2], P3: [3, 4], P5: [5, 6], P7: [7, 8] };

function clean(n) {
  if (n === null || n === undefined) return null;
  const s = String(n).trim();
  return s === "" ? null : s;
}
function known(name) { return { pending: false, name: name }; }
function waiting(from) { return { pending: true, from: from }; }
