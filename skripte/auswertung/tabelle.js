// =====================================================================
//  Gesamttabelle aus einer Liste ausgewerteter Spieltage
//  (wird auch für den Stand vor dem letzten Spieltag genutzt -> Trendpfeile)
// =====================================================================
import { clean, toNum } from "../kern/hilfen.js";
import { state } from "../kern/zustand.js";

// Zähler für Average und Checkout-Quote an ein Objekt anhängen
// f9Sum/f9N: First-9-Average je Spiel; t100/t140: Aufnahmen; tN: Spiele mit gezählten Aufnahmen (Live-Zähler)
export function newAcc(o) {
  o.avgSum = 0; o.avgN = 0; o.bestAvg = null; o.coHit = 0; o.coMiss = 0;
  o.f9Sum = 0; o.f9N = 0; o.t100 = 0; o.t140 = 0; o.tN = 0;
  return o;
}

// Average / Missed Doubles eines Spielers aus einem Spiel sammeln
export function addMatchStats(acc, mt, name) {
  if (!mt.stats || !mt.stats[name]) return;
  const ps = mt.stats[name];
  const avg = toNum(ps.avg), miss = toNum(ps.miss);
  if (avg !== null) {
    acc.avgSum += avg; acc.avgN++;
    if (acc.bestAvg === null || avg > acc.bestAvg) acc.bestAvg = avg;
  }
  if (miss !== null && mt.score) {
    const mine = mt.a.name === name ? mt.score.a : mt.score.b;
    acc.coHit += mine; acc.coMiss += miss;
  }
  const f9 = toNum(ps.f9), t100 = toNum(ps.t100), t140 = toNum(ps.t140);
  if (f9 !== null) { acc.f9Sum += f9; acc.f9N++; }
  if (t100 !== null || t140 !== null) { acc.t100 += t100 || 0; acc.t140 += t140 || 0; acc.tN++; }
}

// ---------------------------------------------------------------------
//  Ergebnis: { rows, openTies }
//    rows      sortierte Zeilen mit rank, points, wins, lw/ll, …
//    openTies  Gleichstände, die nur ein Stechen auflösen kann
//  Sortierung: Punkte, dann bei Gleichstand:
//    1. direkter Vergleich (wenn jeder gegen jeden gespielt hat)
//    2. Legdifferenz  3. gewonnene Spieltage  4. Entscheidungsleg/Stechen
// ---------------------------------------------------------------------
export function computeStandings(resolved) {
  const stats = {};
  const h2h = {};
  function stat(name) {
    if (!stats[name]) stats[name] = newAcc({ name: name, days: 0, wins: 0, seconds: 0, points: 0, bonus: 0, lw: 0, ll: 0, legs: false });
    return stats[name];
  }
  resolved.forEach(function (d) {
    d.players.forEach(function (p) {
      if (!p) return;
      const s = stat(p);
      s.days++;
      const b = d.bonus.pointsOf(p);
      s.bonus += b; s.points += b;
    });
    d.places.forEach(function (pl) {
      if (!pl.name) return;
      const s = stat(pl.name);
      s.points += pl.points;
      if (pl.place === 1) s.wins++;
      if (pl.place === 2) s.seconds++;
    });
    Object.keys(d.matches).forEach(function (id) {
      const mt = d.matches[id];
      if (mt.stats) [mt.a.name, mt.b.name].forEach(function (n) { if (n) addMatchStats(stat(n), mt, n); });
      if (mt.state !== "gespielt") return;
      if (mt.score) {
        const sa = stat(mt.a.name), sb = stat(mt.b.name);
        sa.lw += mt.score.a; sa.ll += mt.score.b; sa.legs = true;
        sb.lw += mt.score.b; sb.ll += mt.score.a; sb.legs = true;
      }
      h2h[mt.winner] = h2h[mt.winner] || {};
      h2h[mt.winner][mt.loser] = (h2h[mt.winner][mt.loser] || 0) + 1;
    });
  });
  function h2hWins(x, y) { return (h2h[x] && h2h[x][y]) || 0; }
  const tableStechen = (Array.isArray(state.liga.stechen) ? state.liga.stechen : []).map(clean).filter(Boolean);

  const rows = [];
  const openTies = [];
  let rankCounter = 0;
  function pushGroup(list, shared) {
    const rank = rankCounter + 1;
    list.forEach(function (r, i) { r.rank = shared ? rank : rank + i; r.tied = shared && list.length > 1; rows.push(r); });
    rankCounter += list.length;
  }
  // Liste nach `key` sortieren und jede Gruppe mit gleichem Schlüssel an `next` geben
  function splitBy(list, key, next) {
    const sorted = list.slice().sort(function (a, b) {
      const ka = key(a), kb = key(b);
      for (let i = 0; i < ka.length; i++) if (kb[i] !== ka[i]) return kb[i] - ka[i];
      return 0;
    });
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && key(sorted[j + 1]).join() === key(sorted[i]).join()) j++;
      next(sorted.slice(i, j + 1));
      i = j + 1;
    }
  }
  // 1. direkter Vergleich: nur wenn jeder gegen jeden mindestens einmal gespielt hat
  function byHeadToHead(list) {
    if (list.length === 1) { pushGroup(list, false); return; }
    let meaningful = true;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (!h2hWins(list[i].name, list[j].name) && !h2hWins(list[j].name, list[i].name)) meaningful = false;
    }
    if (!meaningful) { byLegsAndWins(list); return; }
    list.forEach(function (r) {
      r.h2h = list.reduce(function (sum, o) { return sum + (o === r ? 0 : h2hWins(r.name, o.name)); }, 0);
    });
    splitBy(list, function (r) { return [r.h2h]; }, byLegsAndWins);
  }
  // 2. Legdifferenz, 3. gewonnene Spieltage
  function byLegsAndWins(list) {
    if (list.length === 1) { pushGroup(list, false); return; }
    splitBy(list, function (r) { return [r.lw - r.ll, r.wins]; }, byStechen);
  }
  // 4. Entscheidungsleg/Stechen (im Bearbeiten-Modus eingetragen)
  function byStechen(list) {
    if (list.length === 1) { pushGroup(list, false); return; }
    const allIn = list.every(function (r) { return tableStechen.indexOf(r.name) >= 0; });
    if (allIn) {
      list.slice().sort(function (a, b) { return tableStechen.indexOf(a.name) - tableStechen.indexOf(b.name); })
        .forEach(function (r) { pushGroup([r], false); });
    } else {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, "de"); });
      if (list[0].points > 0) openTies.push(list.map(function (r) { return r.name; }));
      pushGroup(list, true);
    }
  }

  const all = Object.keys(stats).map(function (k) { return stats[k]; });
  splitBy(all, function (r) { return [r.points]; }, byHeadToHead);
  return { rows: rows, openTies: openTies };
}
