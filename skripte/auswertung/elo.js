// =====================================================================
//  Elo-Wertung und Siegchance
//  Erwartung = 1 / (1 + 10^((Gegner - eigene Wertung) / 400))
//  Neue Wertung = alte Wertung + K * (Ergebnis - Erwartung)
//  Die Wertung läuft über alle Saisons weiter (eloChain).
// =====================================================================
import { ELO_START, ELO_K, ELO_ORDER, DUELL_PRIOR } from "../kern/konstanten.js";
import { state } from "../kern/zustand.js";
import { resolveAll } from "./spieltag.js";

export function eloExpected(ra, rb) { return 1 / (1 + Math.pow(10, (rb - ra) / 400)); }

// Elo über alle Spiele der Saison (in der Reihenfolge der Spieltage)
// start (optional): Stand aus früheren Saisons { Name: { rating, games, peak, seasons } }
export function computeElo(resolved, start) {
  const elo = {};
  Object.keys(start || {}).forEach(function (n) {
    const s = start[n];
    elo[n] = { rating: s.rating, games: s.games || 0, peak: s.peak || s.rating, prev: s.rating, history: [], seasons: s.seasons || 0, inSeason: false };
  });
  function get(n) {
    if (!elo[n]) elo[n] = { rating: ELO_START, games: 0, peak: ELO_START, prev: ELO_START, history: [], seasons: 0, inSeason: false };
    if (!elo[n].inSeason) { elo[n].inSeason = true; elo[n].seasons++; }
    return elo[n];
  }
  resolved.forEach(function (d, idx) {
    const played = ELO_ORDER.filter(function (id) { return d.matches[id] && d.matches[id].state === "gespielt"; });
    if (!played.length) return;
    Object.keys(elo).forEach(function (n) { elo[n].prev = elo[n].rating; });
    played.forEach(function (id) {
      const mt = d.matches[id];
      const w = get(mt.winner), l = get(mt.loser);
      const delta = ELO_K * (1 - eloExpected(w.rating, l.rating));
      w.rating += delta; l.rating -= delta;
      w.games++; l.games++;
      if (w.rating > w.peak) w.peak = w.rating;
    });
    const nr = d.nr != null ? d.nr : idx + 1;
    d.players.forEach(function (p) { if (p && elo[p]) elo[p].history.push({ nr: nr, rating: elo[p].rating }); });
  });
  Object.keys(elo).forEach(function (n) { elo[n].delta = elo[n].rating - elo[n].prev; });
  return elo;
}

// ---------------------------------------------------------------------
//  Elo über alle Saisons
// ---------------------------------------------------------------------

// Startwerte für die gerade angezeigte Saison (Stand am Ende der Saison davor)
export function eloStartFor() {
  if (state.archiveView) return state.eloChain.bySeason[state.archiveView.id] || null;
  return state.eloChain.current;
}

function plainElo(elo) {
  const out = {};
  Object.keys(elo).forEach(function (n) {
    out[n] = { rating: elo[n].rating, games: elo[n].games, peak: elo[n].peak, seasons: elo[n].seasons };
  });
  return out;
}

// Archivierte Saisons der Reihe nach durchrechnen
export function rebuildEloChain() {
  let running = {};
  const bySeason = {};
  state.seasons.forEach(function (s) {
    bySeason[s.id] = running;
    const days = state.archives[s.id];
    if (!days) return;   // nicht geladen: Saison wird übersprungen
    running = plainElo(computeElo(resolveAll(days), running));
  });
  state.eloChain = { bySeason: bySeason, current: running };
}

// ---------------------------------------------------------------------
//  Siegchance aus Elo und direkten Duellen
//  Bilanz der Duelle = Mittel aus Spiel-Siegquote und Leg-Anteil (falls Legs da).
//  Je mehr Duelle es gibt, desto stärker zählen sie:
//  Gewicht = Duelle / (Duelle + DUELL_PRIOR), bei 2 Duellen also 50 %,
//  bei 4 Duellen 67 %, bei 6 Duellen 75 %. Ergebnis zwischen 5 % und 95 %.
// ---------------------------------------------------------------------
export function duelChance(ea, eb, duels) {
  const pElo = eloExpected(ea.rating, eb.rating);
  const n = duels.length;
  const wins = duels.filter(function (x) { return x.aWon; }).length;
  const withLegs = duels.filter(function (x) { return x.sa !== null; });
  const lw = withLegs.reduce(function (s, x) { return s + x.sa; }, 0);
  const ll = withLegs.reduce(function (s, x) { return s + x.sb; }, 0);
  if (!n) return { p: pElo, pElo: pElo, n: 0, wins: 0, weight: 0, legs: false, lw: 0, ll: 0 };
  let h2h = wins / n;
  if (lw + ll > 0) h2h = (h2h + lw / (lw + ll)) / 2;
  const weight = n / (n + DUELL_PRIOR);
  const p = Math.min(0.95, Math.max(0.05, weight * h2h + (1 - weight) * pElo));
  return { p: p, pElo: pElo, n: n, wins: wins, weight: weight, legs: lw + ll > 0, lw: lw, ll: ll };
}
