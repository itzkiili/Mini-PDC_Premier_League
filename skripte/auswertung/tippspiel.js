// =====================================================================
//  Tippspiele (z. B. Tipps zum Grand Slam)
//  Stehen in LIGA.tippspiele, damit sie beim Saisonwechsel mit ins Archiv
//  gehen:  { name, datum, tipps: { "Kilian": 7, "Leon": 4 }, punkte: 5 }
//    tipps   Punkte jedes Spielers im Tippspiel (bestimmen den Gewinner)
//    punkte  Punkte für die Ligatabelle, die nur der Gewinner bekommt
//  Gewinner: die meisten Tipp-Punkte (mehr als 0), bei Gleichstand alle.
//  Die Punkte zählen in der Gesamttabelle (Spalte „Tipp“), nicht als Bonus.
// =====================================================================
import { clean, toNum } from "../kern/hilfen.js";

export const TIPP_PUNKTE = 5;   // Punkte für den Gewinner, wenn nichts anderes eingetragen ist

// Gewinner aus den Tipp-Punkten
function winnersOf(tipps) {
  const names = Object.keys(tipps);
  const best = Math.max.apply(null, names.map(function (n) { return tipps[n]; }).concat([0]));
  if (best <= 0) return [];
  return names.filter(function (n) { return tipps[n] === best; });
}

// Bereinigte Liste mit ausgerechneten Gewinnern
export function tippList(liga) {
  const list = liga && Array.isArray(liga.tippspiele) ? liga.tippspiele : [];
  return list.filter(function (t) { return t && typeof t === "object"; }).map(function (t) {
    const tipps = {};
    Object.keys(t.tipps || {}).forEach(function (n) {
      const name = clean(n), v = toNum(t.tipps[n]);
      if (name && v !== null) tipps[name] = Math.round(v);
    });
    const p = toNum(t.punkte);
    return { name: clean(t.name) || "Tippspiel", datum: clean(t.datum), tipps: tipps,
      punkte: p !== null ? Math.round(p) : TIPP_PUNKTE, sieger: winnersOf(tipps) };
  });
}

// Tabellenpunkte je Spieler über alle Tippspiele (nur Gewinner)
export function tippPoints(list) {
  const sum = {};
  list.forEach(function (t) {
    t.sieger.forEach(function (n) { sum[n] = (sum[n] || 0) + t.punkte; });
  });
  return sum;
}

// Gewinner eines Tippspiels
export function tippWinners(t) { return t.sieger; }
