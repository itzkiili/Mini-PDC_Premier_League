// =====================================================================
//  Spielmodus: Startpunkte, Double In, Checkout und Legs
//
//  Drei Ebenen, jede überschreibt nur, was sie angibt:
//    1. MODUS_STANDARD           wenn in ergebnisse.js nichts steht
//    2. LIGA.modus               Standard der Saison
//    3. Spieltag.modus           Abweichung an einem Spieltag (Spezial-Spieltage)
//
//  Felder:
//    start       Startpunkte (z. B. 501, 301, 170)
//    ein         "single" oder "double" (Double In)
//    aus         "double", "master" (Doppel oder Triple) oder "single"
//    legs        Gewinnlegs in normalen Runden (2 = Best of 3)
//    legsFinale  Gewinnlegs im großen Finale (3 = Best of 5)
//    legsPlus    zusätzliche Gewinnlegs an diesem Spieltag (170er-Legs: 1)
// =====================================================================

export const MODUS_STANDARD = { start: 501, ein: "single", aus: "double", legs: 2, legsFinale: 3, legsPlus: 0 };

// Reihenfolge der Felder beim Schreiben von ergebnisse.js
export const MODUS_FELDER = ["start", "ein", "aus", "legs", "legsFinale", "legsPlus"];

// Fertige Modi für Spezial-Spieltage (Regelwerk 3.2)
export const MODUS_VORLAGEN = [
  { id: "doublein", name: "Double In", modus: { ein: "double" } },
  { id: "170", name: "170er-Legs", modus: { start: 170, legsPlus: 1 } },
  { id: "masterout", name: "Master Out", modus: { aus: "master" } },
];

export const AUS_NAMEN = { double: "Double Out", master: "Master Out", single: "Single Out" };

// Zulässige Werte je Feld
const PRUEFEN = {
  start: function (v) { return Number.isInteger(v) && v >= 2 && v <= 1001; },
  ein: function (v) { return v === "single" || v === "double"; },
  aus: function (v) { return v === "double" || v === "master" || v === "single"; },
  legs: function (v) { return Number.isInteger(v) && v >= 1 && v <= 9; },
  legsFinale: function (v) { return Number.isInteger(v) && v >= 1 && v <= 9; },
  legsPlus: function (v) { return Number.isInteger(v) && v >= 0 && v <= 5; },
};

// Nur gültige Felder übernehmen; nichts Gültiges -> null
export function cleanModus(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const out = {};
  MODUS_FELDER.forEach(function (k) {
    let v = m[k];
    if (k !== "ein" && k !== "aus" && v !== undefined && v !== null && v !== "") v = Number(v);
    if (v !== undefined && PRUEFEN[k](v)) out[k] = v;
  });
  return Object.keys(out).length ? out : null;
}

// Modus der Saison (Standard + LIGA.modus)
export function seasonModus(liga) {
  return Object.assign({}, MODUS_STANDARD, cleanModus(liga && liga.modus));
}

// Modus eines Spieltags (Saison + Spieltag.modus)
export function dayModus(day, liga) {
  return Object.assign(seasonModus(liga), cleanModus(day && day.modus));
}

// Gewinnlegs für ein bestimmtes Spiel (VF1, Finale, G2, …)
export function legsToWin(m, matchId) {
  return (matchId === "Finale" ? m.legsFinale : m.legs) + (m.legsPlus || 0);
}

// Format eines Spiels, z. B. für den Zähler: { start, ein, aus, legsToWin }
export function matchFormat(day, liga, matchId) {
  const m = dayModus(day, liga);
  return { start: m.start, ein: m.ein, aus: m.aus, legsToWin: legsToWin(m, matchId) };
}

// Passende Vorlage für den Modus eines Spieltags (oder null)
export function vorlageOf(dayModusRaw) {
  const m = cleanModus(dayModusRaw);
  if (!m) return null;
  return MODUS_VORLAGEN.filter(function (v) { return JSON.stringify(cleanModus(v.modus)) === JSON.stringify(m); })[0] || null;
}

// "Best of 3"
export function bestOf(n) { return "Best of " + (2 * n - 1); }

// Kurzbeschreibung, z. B. "170 Double Out · Best of 5"
export function modusText(m, finale) {
  const legs = finale ? legsToWin(m, "Finale") : legsToWin(m, "VF1");
  return m.start + (m.ein === "double" ? " Double In" : "") + " " + AUS_NAMEN[m.aus] + " · " + bestOf(legs);
}
