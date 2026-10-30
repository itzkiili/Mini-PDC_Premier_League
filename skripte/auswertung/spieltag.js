// =====================================================================
//  Auswertung eines Spieltags: Turnierbaum, Dreiergruppen, Platzierungen, Bonuspunkte
//  Reine Berechnung, ohne Zugriff auf die Seite.
// =====================================================================
import { PLACE_OF } from "../kern/konstanten.js";
import { clean } from "../kern/hilfen.js";
import { punkte, bonusCfg } from "../kern/zustand.js";

function known(name) { return { pending: false, name: name }; }
function waiting(from) { return { pending: true, from: from }; }

// ---------------------------------------------------------------------
//  Ergebnis von resolveDay:
//    mode      "ko" (7–8 Spieler) oder "gruppe" (5–6 Spieler)
//    matches   { VF1: { a, b, state, winner, loser, score, stats }, … }
//              state: "offen", "gespielt", "wartet", "freilos" oder "leer"
//    places    [{ place, name, points }]  name undefined = noch offen
//    groups    nur bei "gruppe"
//    invalid*  Einträge, die nicht (mehr) passen -> cleanupDay
//  Probleme werden als Text in `warnings` gesammelt.
// ---------------------------------------------------------------------
export function resolveDay(day, warnings) {
  const label = "Spieltag " + (day.nr != null ? day.nr : "?");
  const raw = Array.isArray(day.spieler) ? day.spieler.slice(0, 8) : [];
  while (raw.length < 8) raw.push(null);
  const players = raw.map(clean);
  const seen = {};
  players.forEach(function (p) {
    if (!p) return;
    if (seen[p]) warnings.push(label + ": „" + p + "“ steht zweimal in der Spielerliste.");
    seen[p] = true;
  });
  const sieger = day.sieger || {};
  const m = {};
  const invalid = [];
  const invalidScore = [];
  const invalidStats = [];
  const stx = (day.statistik && typeof day.statistik === "object") ? day.statistik : {};
  const erg = (day.ergebnisse && typeof day.ergebnisse === "object") ? day.ergebnisse : {};

  function scoreFor(id, an, bn) {
    const e = erg[id];
    if (!e || typeof e !== "object") return null;
    const keys = Object.keys(e);
    if (keys.length !== 2 || !(an in e) || !(bn in e)) { invalidScore.push(id); return null; }
    const x = Number(e[an]), y = Number(e[bn]);
    if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || e[an] === "" || e[bn] === "" || e[an] === null || e[bn] === null) { invalidScore.push(id); return null; }
    return { a: x, b: y };
  }

  // Ein Spiel auswerten; a und b sind known(name) oder waiting(text)
  function play(id, a, b) {
    const match = { id: id, a: a, b: b, winner: null, loser: null, state: "offen" };
    if (a.pending || b.pending) {
      match.state = "wartet";
      match.w = waiting("Sieger " + id); match.l = waiting("Verlierer " + id);
      if (clean(sieger[id])) invalid.push(id);
      if (erg[id]) invalidScore.push(id);
      if (stx[id]) invalidStats.push(id);
    } else if (a.name === null && b.name === null) {
      if (erg[id]) invalidScore.push(id);
      if (stx[id]) invalidStats.push(id);
      match.state = "leer";
      match.w = known(null); match.l = known(null);
    } else if (a.name === null || b.name === null) {
      const real = a.name !== null ? a.name : b.name;
      if (erg[id]) invalidScore.push(id);
      if (stx[id]) invalidStats.push(id);
      match.state = "freilos"; match.winner = real;
      match.w = known(real); match.l = known(null);
    } else {
      let w = clean(sieger[id]);
      const sc = scoreFor(id, a.name, b.name);
      const sx = stx[id];
      if (sx && typeof sx === "object") {
        if (Object.keys(sx).every(function (k) { return k === a.name || k === b.name; })) match.stats = sx;
        else invalidStats.push(id);
      }
      if (sc) {
        match.score = sc;
        // Bei Gleichstand (z. B. während der Eingabe) bleibt der bisherige Sieger
        if (sc.a !== sc.b) w = sc.a > sc.b ? a.name : b.name;
      }
      if (!w) {
        match.state = "offen";
        match.w = waiting("Sieger " + id); match.l = waiting("Verlierer " + id);
      } else if (w !== a.name && w !== b.name) {
        warnings.push(label + ", " + id + ": „" + w + "“ ist kein Spieler dieses Spiels (" + a.name + " gegen " + b.name + ").");
        invalid.push(id);
        match.state = "offen";
        match.w = waiting("Sieger " + id); match.l = waiting("Verlierer " + id);
      } else {
        match.state = "gespielt"; match.winner = w;
        match.loser = w === a.name ? b.name : a.name;
        match.w = known(w); match.l = known(match.loser);
      }
    }
    m[id] = match;
    return match;
  }

  const count = players.filter(Boolean).length;
  const common = {
    count: count, nr: day.nr, datum: day.datum, players: players, matches: m,
    invalid: invalid, invalidScore: invalidScore, invalidStats: invalidStats,
  };

  if (count === 5 || count === 6) {
    return Object.assign(resolveGroups(day, players, m, play, warnings, label), common, {
      bonus: dayBonus(day, players),
    });
  }
  return Object.assign(resolveKo(players, m, play), common, { bonus: dayBonus(day, players) });
}

// ---------- 7–8 Spieler: Turnierbaum ----------
function resolveKo(players, m, play) {
  const P = players.map(known);
  play("VF1", P[0], P[1]); play("VF2", P[2], P[3]);
  play("VF3", P[4], P[5]); play("VF4", P[6], P[7]);
  play("HF1", m.VF1.w, m.VF2.w); play("HF2", m.VF3.w, m.VF4.w);
  play("PR1", m.VF1.l, m.VF2.l); play("PR2", m.VF3.l, m.VF4.l);
  play("Finale", m.HF1.w, m.HF2.w); play("P3", m.HF1.l, m.HF2.l);
  play("P5", m.PR1.w, m.PR2.w); play("P7", m.PR1.l, m.PR2.l);

  const places = [];
  Object.keys(PLACE_OF).forEach(function (id) {
    const mt = m[id], pl = PLACE_OF[id];
    const done = !mt.w.pending;
    places.push({ place: pl[0], name: done ? mt.w.name : undefined });
    places.push({ place: pl[1], name: done ? mt.l.name : undefined });
  });
  places.sort(function (x, y) { return x.place - y.place; });
  places.forEach(function (p) { p.points = p.name ? (punkte()[p.place - 1] || 0) : 0; });

  const complete = ["Finale", "P3", "P5", "P7"].every(function (id) { return !m[id].w.pending; });
  return { mode: "ko", places: places, complete: complete };
}

// ---------- 5–6 Spieler: drei Viertelfinals, dann zwei Dreiergruppen ----------
function resolveGroups(day, players, m, play, warnings, label) {
  const list = players.filter(Boolean);
  while (list.length < 6) list.push(null);
  const Q = list.map(known);
  play("VF1", Q[0], Q[1]); play("VF2", Q[2], Q[3]); play("VF3", Q[4], Q[5]);
  const stechen = day.stechen || {};

  // Jeder gegen jeden: Spiel 1 = Platz 0 gegen 1, Spiel 2 = 1 gegen 2, Spiel 3 = 0 gegen 2
  function makeGroup(key, title, slots, ids, offset) {
    const pairs = [[0, 1], [1, 2], [0, 2]];
    const matches = ids.map(function (id, i) { return play(id, slots[pairs[i][0]], slots[pairs[i][1]]); });
    const g = { key: key, title: title, offset: offset, matches: matches, members: [], wins: {}, order: null, tie: false, badStechen: false };
    if (slots.some(function (x) { return x.pending; })) return g;
    g.members = slots.map(function (x) { return x.name; }).filter(Boolean);
    g.members.forEach(function (n) { g.wins[n] = 0; });
    const real = matches.filter(function (mt) { return mt.state !== "leer" && mt.state !== "freilos"; });
    real.forEach(function (mt) { if (mt.state === "gespielt") g.wins[mt.winner]++; });
    g.legs = {};
    g.members.forEach(function (n) { g.legs[n] = { w: 0, l: 0, any: false }; });
    real.forEach(function (mt) {
      if (!mt.score) return;
      g.legs[mt.a.name].w += mt.score.a; g.legs[mt.a.name].l += mt.score.b; g.legs[mt.a.name].any = true;
      g.legs[mt.b.name].w += mt.score.b; g.legs[mt.b.name].l += mt.score.a; g.legs[mt.b.name].any = true;
    });
    if (real.some(function (mt) { return mt.state !== "gespielt"; })) return g;
    const sorted = g.members.slice().sort(function (a, b) { return g.wins[b] - g.wins[a]; });
    const values = sorted.map(function (n) { return g.wins[n]; });
    const distinct = values.every(function (v, i) { return values.indexOf(v) === i; });
    if (distinct) { g.order = sorted; return g; }
    // Gleichstand: Reihenfolge aus dem Stechen
    g.tie = true;
    const st = (Array.isArray(stechen[key]) ? stechen[key] : []).map(clean).filter(Boolean);
    const ok = st.length === g.members.length && g.members.every(function (n) { return st.indexOf(n) >= 0; });
    if (ok) g.order = st;
    else if (st.length) {
      g.badStechen = true;
      warnings.push(label + ", " + title + ": Beim Stechen müssen genau diese Spieler stehen: " + g.members.join(", ") + ".");
    }
    return g;
  }

  const groups = [
    makeGroup("G", "Gewinnergruppe", [m.VF1.w, m.VF2.w, m.VF3.w], ["G1", "G2", "G3"], 0),
    makeGroup("V", "Verlierergruppe", [m.VF1.l, m.VF2.l, m.VF3.l], ["V1", "V2", "V3"], 3),
  ];
  const places = [];
  groups.forEach(function (g) {
    for (let i = 0; i < 3; i++) {
      const place = g.offset + i + 1;
      let name;
      if (g.order) name = g.order[i] !== undefined ? g.order[i] : null;
      else if (!g.members.length) name = undefined;
      else name = i < g.members.length ? undefined : null;
      places.push({ place: place, name: name, points: name ? (punkte("gruppe")[place - 1] || 0) : 0 });
    }
  });
  return {
    mode: "gruppe", groups: groups, places: places,
    complete: groups.every(function (g) { return g.order; }),
  };
}

// ---------------------------------------------------------------------
//  Bonuspunkte eines Spieltags: höchstes Checkout, kürzestes Leg, jede 180
//  Bei gleichem Bestwert bekommen alle den Bonus.
// ---------------------------------------------------------------------
export function dayBonus(day, players) {
  const raw = (day.bonus && typeof day.bonus === "object") ? day.bonus : {};
  const cfg = bonusCfg();
  const res = { per: {}, bestCo: null, coNames: [], bestLeg: null, legNames: [], n180: 0, invalid: [], any: false };
  const num = function (v) { if (v === null || v === undefined || v === "") return null; const x = Number(v); return isFinite(x) ? x : null; };
  Object.keys(raw).forEach(function (name) {
    if (players.indexOf(name) < 0) { res.invalid.push(name); return; }
    const v = raw[name] || {};
    const co = num(v.co), leg = num(v.leg), n = num(v.n180);
    const p = res.per[name] = { co: co, leg: leg, n180: n || 0, pts: 0, gotCo: false, gotLeg: false };
    if (co !== null || leg !== null || n) res.any = true;
    if (co !== null && co > 0) {
      if (res.bestCo === null || co > res.bestCo) { res.bestCo = co; res.coNames = [name]; }
      else if (co === res.bestCo) res.coNames.push(name);
    }
    if (leg !== null && leg > 0) {
      if (res.bestLeg === null || leg < res.bestLeg) { res.bestLeg = leg; res.legNames = [name]; }
      else if (leg === res.bestLeg) res.legNames.push(name);
    }
    if (n) { p.pts += n * cfg.je180; res.n180 += n; }
  });
  res.coNames.forEach(function (n) { res.per[n].pts += cfg.checkout; res.per[n].gotCo = true; });
  res.legNames.forEach(function (n) { res.per[n].pts += cfg.leg; res.per[n].gotLeg = true; });
  res.pointsOf = function (name) { return res.per[name] ? res.per[name].pts : 0; };
  return res;
}

// ---------------------------------------------------------------------
//  Entfernt Einträge, die nach einer Änderung nicht mehr passen
//  (z. B. wenn ein früheres Ergebnis korrigiert wurde).
// ---------------------------------------------------------------------
export function cleanupDay(day) {
  day.sieger = day.sieger || {};
  for (let i = 0; i < 20; i++) {
    const r = resolveDay(day, []);
    let changed = false;
    r.invalid.forEach(function (id) { delete day.sieger[id]; changed = true; });
    r.invalidScore.forEach(function (id) { if (day.ergebnisse) { delete day.ergebnisse[id]; changed = true; } });
    r.invalidStats.forEach(function (id) { if (day.statistik) { delete day.statistik[id]; changed = true; } });
    r.bonus.invalid.forEach(function (n) { if (day.bonus) { delete day.bonus[n]; changed = true; } });
    if (r.groups) r.groups.forEach(function (g) {
      if (day.stechen && day.stechen[g.key] && day.stechen[g.key].length && (!g.tie || g.badStechen)) {
        delete day.stechen[g.key]; changed = true;
      }
    });
    if (!changed) break;
  }
  Object.keys(day.sieger).forEach(function (k) { if (!clean(day.sieger[k])) delete day.sieger[k]; });
  if (day.ergebnisse && !Object.keys(day.ergebnisse).length) delete day.ergebnisse;
  if (day.statistik && !Object.keys(day.statistik).length) delete day.statistik;
  if (day.bonus && !Object.keys(day.bonus).length) delete day.bonus;
}

// Alle Spieltage einer Saison auswerten (ohne Warnungen)
export function resolveAll(days) {
  return days.map(function (d) { return resolveDay(d, []); });
}
