// =====================================================================
//  Statistik eines Spielers und direkte Duelle
// =====================================================================
import { PLAY_ORDER, LABELS } from "../kern/konstanten.js";
import { toNum } from "../kern/hilfen.js";
import { state, currentSeasonLabel } from "../kern/zustand.js";
import { addMatchStats, newAcc } from "./tabelle.js";
import { resolveAll } from "./spieltag.js";

// Ausgewertete Spieltage aller archivierten Saisons vor der angezeigten, älteste zuerst
export function earlierSeasons() {
  const list = [];
  for (let i = 0; i < state.seasons.length; i++) {
    const s = state.seasons[i];
    if (state.archiveView && state.archiveView.id === s.id) break;
    const days = state.archives[s.id];
    if (!days) continue;
    list.push({ season: s, resolved: resolveAll(days) });
  }
  return list;
}

// ---------------------------------------------------------------------
//  Alles für die Spielerkarte aus der angezeigten Saison
// ---------------------------------------------------------------------
export function playerStats(name) {
  const st = newAcc({
    name: name, days: 0, doneDays: 0, points: 0, best: null, bestCount: 0,
    w: 0, l: 0, lw: 0, ll: 0, legGames: 0, dec: 0, decW: 0, nil: 0,
    bonus: 0, donePoints: 0, n180: 0, hiCo: null, bestLeg: null, coTops: 0, legTops: 0, days180: 0,
    history: [], results: [], opp: {},
  });
  state.resolved.forEach(function (d, idx) {
    if (d.players.indexOf(name) < 0) return;
    st.days++;
    const pl = d.places.filter(function (p) { return p.name === name; })[0];
    st.history.push({ nr: d.nr != null ? d.nr : idx + 1, place: pl ? pl.place : null });

    // Bonus
    const bp = d.bonus.per[name];
    const bpts = d.bonus.pointsOf(name);
    st.bonus += bpts; st.points += bpts;
    if (bp) {
      st.n180 += bp.n180 || 0;
      if (bp.n180) st.days180++;
      if (bp.gotCo) st.coTops++;
      if (bp.gotLeg) st.legTops++;
      if (bp.co && (st.hiCo === null || bp.co > st.hiCo)) st.hiCo = bp.co;
      if (bp.leg && (st.bestLeg === null || bp.leg < st.bestLeg)) st.bestLeg = bp.leg;
    }
    // Platzierung
    if (pl) {
      st.doneDays++;
      st.points += pl.points;
      st.donePoints += pl.points + bpts;
      if (st.best === null || pl.place < st.best) { st.best = pl.place; st.bestCount = 1; }
      else if (pl.place === st.best) st.bestCount++;
    }
    // Spiele
    PLAY_ORDER.forEach(function (id) {
      const mt = d.matches[id];
      if (mt && mt.stats && (mt.a.name === name || mt.b.name === name)) addMatchStats(st, mt, name);
      if (!mt || mt.state !== "gespielt") return;
      const an = mt.a.name, bn = mt.b.name;
      if (an !== name && bn !== name) return;
      const opp = an === name ? bn : an;
      const won = mt.winner === name;
      st.results.push(won);
      if (won) st.w++; else st.l++;
      const o = st.opp[opp] || (st.opp[opp] = { name: opp, w: 0, l: 0, lw: 0, ll: 0, legs: false });
      if (won) o.w++; else o.l++;
      if (mt.score) {
        const mine = an === name ? mt.score.a : mt.score.b;
        const theirs = an === name ? mt.score.b : mt.score.a;
        st.lw += mine; st.ll += theirs; st.legGames++;
        o.lw += mine; o.ll += theirs; o.legs = true;
        if (Math.abs(mine - theirs) === 1 && Math.min(mine, theirs) > 0) { st.dec++; if (mine > theirs) st.decW++; }
        if (won && theirs === 0) st.nil++;
      }
    });
  });

  // Aktuelle Serie
  let streak = 0, streakWin = null;
  for (let i = st.results.length - 1; i >= 0; i--) {
    if (streakWin === null) streakWin = st.results[i];
    if (st.results[i] !== streakWin) break;
    streak++;
  }
  st.streak = streak; st.streakWin = streakWin;

  // Lieblings- und Angstgegner
  // Reihenfolge: Spielbilanz, bei Gleichstand Legdifferenz, dann mehr Spiele
  const opps = Object.keys(st.opp).map(function (k) { return st.opp[k]; });
  const legDiff = function (o) { return o.lw - o.ll; };
  opps.sort(function (a, b) {
    return (b.w - b.l) - (a.w - a.l) || legDiff(b) - legDiff(a) || (b.w + b.l) - (a.w + a.l) || a.name.localeCompare(b.name, "de");
  });
  st.opps = opps;
  // Ausgeglichene Spielbilanz (z. B. 1–1): die Legs entscheiden
  const fav = opps.filter(function (o) { return o.w > o.l || (o.w === o.l && legDiff(o) > 0); })[0];
  const nem = opps.filter(function (o) { return o.l > o.w || (o.w === o.l && legDiff(o) < 0); })
    .sort(function (a, b) { return (a.w - a.l) - (b.w - b.l) || legDiff(a) - legDiff(b) || (b.w + b.l) - (a.w + a.l); })[0];
  st.fav = fav || null; st.nem = nem || null;
  return st;
}

// ---------------------------------------------------------------------
//  Direkte Duelle zwischen a und b, aus Sicht von a
// ---------------------------------------------------------------------
export function headToHead(a, b, resolvedList, season) {
  const list = [];
  resolvedList.forEach(function (d, idx) {
    PLAY_ORDER.forEach(function (id) {
      const mt = d.matches[id];
      if (!mt || mt.state !== "gespielt") return;
      const an = mt.a.name, bn = mt.b.name;
      if (!((an === a && bn === b) || (an === b && bn === a))) return;
      const aFirst = an === a;
      const sa = mt.score ? (aFirst ? mt.score.a : mt.score.b) : null;
      const sb = mt.score ? (aFirst ? mt.score.b : mt.score.a) : null;
      const avgOf = function (n) { const ps = mt.stats && mt.stats[n]; return ps ? toNum(ps.avg) : null; };
      list.push({
        nr: d.nr != null ? d.nr : idx + 1, label: LABELS[id], aWon: mt.winner === a, season: season || null,
        sa: sa, sb: sb, avgA: avgOf(a), avgB: avgOf(b),
      });
    });
  });
  return list;
}

// Nur die angezeigte Saison
export function headToHeadSeason(a, b) {
  return headToHead(a, b, state.resolved, currentSeasonLabel());
}

// Über alle Saisons bis zur angezeigten
export function headToHeadAll(a, b) {
  const list = [];
  earlierSeasons().forEach(function (x) {
    Array.prototype.push.apply(list, headToHead(a, b, x.resolved, x.season.name));
  });
  return list.concat(headToHeadSeason(a, b));
}
