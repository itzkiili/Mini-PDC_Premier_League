// =====================================================================
//  Feste Einstellungen: Dateipfade, Punkte, Elo, Namen und Reihenfolge der Spiele
// =====================================================================

// ---------- Dateien im Repository ----------
export const DATA_FILE = "daten/ergebnisse.js";
export const ACCESS_FILE = "daten/zugang.js";
export const SEASON_INDEX_FILE = "daten/saisons.js";
export const ARCHIVE_FOLDER = "daten/archiv/";
export const PROFILE_FILE = "daten/spieler.js";
export const PROFILE_IMG_DIR = "daten/bilder/";
export const PROFILE_IMG_SIZE = 400;   // Profilbilder werden quadratisch auf 400 × 400 verkleinert

// ---------- Punkte (falls in ergebnisse.js nichts steht) ----------
export const DEFAULT_PUNKTE = [15, 13, 11, 9, 9, 7, 6, 5];   // 7–8 Spieler (Turnierbaum)

// ---------- Elo-Wertung ----------
export const ELO_START = 1000;   // Startwert jedes Spielers
export const ELO_K = 40;         // wie stark ein einzelnes Spiel zählt
// Siegchance: so viele „gedachte“ Duelle zählen für die Elo-Erwartung.
// Gewicht der echten Duelle = Duelle / (Duelle + DUELL_PRIOR)
export const DUELL_PRIOR = 2;

// ---------- Spiele eines Spieltags ----------
export const LABELS = {
  VF1: "Viertelfinale 1", VF2: "Viertelfinale 2", VF3: "Viertelfinale 3", VF4: "Viertelfinale 4",
  HF1: "Halbfinale 1", HF2: "Halbfinale 2", Finale: "Finale", P3: "Spiel um Platz 3",
  PR1: "Platzierungsrunde 1", PR2: "Platzierungsrunde 2", P5: "Spiel um Platz 5", P7: "Spiel um Platz 7",
  G1: "Gruppenspiel 1", G2: "Gruppenspiel 2", G3: "Gruppenspiel 3",
  V1: "Gruppenspiel 1", V2: "Gruppenspiel 2", V3: "Gruppenspiel 3",
};

// Reihenfolge der Einträge beim Schreiben von ergebnisse.js
export const KEY_ORDER = ["VF1", "VF2", "VF3", "VF4", "PR1", "PR2", "HF1", "HF2", "P7", "P5", "P3", "Finale",
  "G1", "G2", "G3", "V1", "V2", "V3"];

// Tatsächliche Spielreihenfolge am Abend (Statistik, Serien, „Nächstes Spiel“)
export const PLAY_ORDER = ["VF1", "VF2", "VF3", "VF4", "PR1", "PR2", "HF1", "HF2", "P7", "P5", "P3", "Finale",
  "V1", "G1", "V2", "G2", "V3", "G3"];

// Reihenfolge, in der die Elo-Wertung die Spiele verrechnet.
// Nicht ändern: eine andere Reihenfolge ergibt andere Elo-Werte.
export const ELO_ORDER = ["VF1", "VF2", "VF3", "VF4", "PR1", "PR2", "HF1", "HF2", "P7", "P5", "P3", "Finale",
  "G1", "V1", "G2", "V2", "G3", "V3"];

// Spiele, die direkt über zwei Plätze entscheiden (Turnierbaum)
export const PLACE_OF = { Finale: [1, 2], P3: [3, 4], P5: [5, 6], P7: [7, 8] };
