// =====================================================================
//  Tippspiele (z. B. Tipps zum Grand Slam)
//  Stehen in LIGA.tippspiele, damit sie beim Saisonwechsel mit ins Archiv
//  gehen:  { name, datum, punkte: { "Kilian": 3, "Leon": 1 } }
//  Die Punkte zählen in der Gesamttabelle (Spalte „Tipp“), nicht als Bonus.
//  Gewonnen hat, wer die meisten Punkte hat (bei Gleichstand alle).
// =====================================================================
import { clean, toNum } from "../kern/hilfen.js";

// Bereinigte Liste: nur Einträge mit Namen und ganzen Punkten
export function tippList(liga) {
  const list = liga && Array.isArray(liga.tippspiele) ? liga.tippspiele : [];
  return list.filter(function (t) { return t && typeof t === "object"; }).map(function (t) {
    const punkte = {};
    Object.keys(t.punkte || {}).forEach(function (n) {
      const name = clean(n), v = toNum(t.punkte[n]);
      if (name && v !== null) punkte[name] = Math.round(v);
    });
    return { name: clean(t.name) || "Tippspiel", datum: clean(t.datum), punkte: punkte };
  });
}

// Punkte je Spieler über alle Tippspiele
export function tippPoints(list) {
  const sum = {};
  list.forEach(function (t) {
    Object.keys(t.punkte).forEach(function (n) { sum[n] = (sum[n] || 0) + t.punkte[n]; });
  });
  return sum;
}

// Sieger eines Tippspiels (meiste Punkte, mehr als 0; bei Gleichstand alle)
export function tippWinners(t) {
  const names = Object.keys(t.punkte);
  const best = Math.max.apply(null, names.map(function (n) { return t.punkte[n]; }).concat([0]));
  if (best <= 0) return [];
  return names.filter(function (n) { return t.punkte[n] === best; });
}
