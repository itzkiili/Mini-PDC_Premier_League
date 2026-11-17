// =====================================================================
//  Auswertung eines Spieltags: Bauplan aus Bausteinen (Baum, Tabelle),
//  Platzierungen, Bonuspunkte
//  Reine Berechnung, ohne Zugriff auf die Seite.
// =====================================================================
import { clean, toNum } from "../kern/hilfen.js";
import { state, punkte, bonusCfg } from "../kern/zustand.js";
import { dayModus } from "./modus.js";

function known(name) { return { pending: false, name: name }; }
function waiting(from) { return { pending: true, from: from }; }

// ---------------------------------------------------------------------
//  Ergebnis von resolveDay:
//    ablauf    Bauplan (siehe ABLAEUFE)
//    matches   { VF1: { a, b, state, winner, loser, score, stats, verlauf?, places? }, … }
//              verlauf: [{ winner, darts, checkout }] je Leg (vom Live-Zähler)
//              state: "offen", "gespielt", "wartet", "freilos" oder "leer"
//              places: bei Platzierungsspielen [Platz Sieger, Platz Verlierer]
//    vorrunde  die Viertelfinals
//    bloecke   [oben, unten], je Baum oder Tabelle
//    places    [{ place, name, points }]  name undefined = noch offen
//    standard  im normalen Ligamodus gespielt (501 Double Out)?
//    groups    die Tabellen-Bausteine (für Stechen)
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
  const invalidVerlauf = [];
  const vlx = (day.verlauf && typeof day.verlauf === "object") ? day.verlauf : {};
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
      if (vlx[id]) invalidVerlauf.push(id);
    } else if (a.name === null && b.name === null) {
      if (erg[id]) invalidScore.push(id);
      if (stx[id]) invalidStats.push(id);
      if (vlx[id]) invalidVerlauf.push(id);
      match.state = "leer";
      match.w = known(null); match.l = known(null);
    } else if (a.name === null || b.name === null) {
      const real = a.name !== null ? a.name : b.name;
      if (erg[id]) invalidScore.push(id);
      if (stx[id]) invalidStats.push(id);
      if (vlx[id]) invalidVerlauf.push(id);
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
      // Legverlauf: [[Sieger, Darts, Checkout], …]
      const vl = vlx[id];
      if (vl !== undefined) {
        const okVl = Array.isArray(vl) && vl.every(function (x) {
          return Array.isArray(x) && (x[0] === a.name || x[0] === b.name);
        });
        if (okVl) match.verlauf = vl.map(function (x) { return { winner: x[0], darts: toNum(x[1]), checkout: toNum(x[2]) }; });
        else invalidVerlauf.push(id);
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
  // Normaler Ligamodus (501 Double Out)? Nur dann zählen Averages für die Saisonstatistik.
  const mod = dayModus(day, state.liga);
  const ablauf = ablaufFor(count);
  const built = buildDay(ablauf, day, players, m, play, warnings, label, count === 5 || count === 6 ? "gruppe" : null);
  return Object.assign(built, {
    count: count, nr: day.nr, datum: day.datum, players: players, matches: m, ablauf: ablauf, modus: mod,
    standard: mod.start === 501 && mod.ein === "single" && mod.aus === "double",
    invalid: invalid, invalidScore: invalidScore, invalidStats: invalidStats, invalidVerlauf: invalidVerlauf,
    bonus: dayBonus(day, players),
  });
}

// ---------------------------------------------------------------------
//  Bauplan eines Spieltags je nach Spielerzahl:
//    vorrunde  Anzahl Viertelfinals (bei ungerader Zahl ist eins kampflos)
//    oben      Baustein für die Sieger der Viertelfinals
//    unten     Baustein für die Verlierer
//  Bausteine: "baum"    = Halbfinals, dann Spiel um den oberen und unteren Platz
//             "tabelle" = jeder gegen jeden (drei Spieler), bei Gleichstand Stechen
//  Hier ändern, um einen Spieltag anders zu spielen.
// ---------------------------------------------------------------------
export const ABLAEUFE = {
  8: { vorrunde: 4, oben: "baum", unten: "baum" },
  7: { vorrunde: 4, oben: "baum", unten: "tabelle" },
  6: { vorrunde: 3, oben: "tabelle", unten: "tabelle" },
  5: { vorrunde: 3, oben: "tabelle", unten: "tabelle" },
};
// Weniger als 5 Spieler (z. B. während der Eingabe): wie bei 8, mit Freilosen
export function ablaufFor(count) { return ABLAEUFE[count] || ABLAEUFE[8]; }

// Spiel-Kennungen der Bausteine; oben und unten haben eigene Kennungen
const BAUM_IDS = {
  oben: { halb: ["HF1", "HF2"], platz: ["Finale", "P3"], titel: "Hauptrunde" },
  unten: { halb: ["PR1", "PR2"], platz: ["P5", "P7"], titel: "Platzierungsrunde" },
};
const TABELLE_IDS = {
  oben: { key: "G", ids: ["G1", "G2", "G3"], titel: "Gewinnergruppe" },
  unten: { key: "V", ids: ["V1", "V2", "V3"], titel: "Verlierergruppe" },
};
const VF_IDS = ["VF1", "VF2", "VF3", "VF4"];

function buildDay(ablauf, day, players, m, play, warnings, label, punkteArt) {
  // Viertelfinals: bei 3 Viertelfinals rücken die Spieler ohne Lücke auf
  const n = ablauf.vorrunde;
  const list = n === 4 ? players.slice(0, 8) : players.filter(Boolean);
  while (list.length < n * 2) list.push(null);
  const vf = VF_IDS.slice(0, n).map(function (id, i) { return play(id, known(list[2 * i]), known(list[2 * i + 1])); });

  const ctx = { day: day, m: m, play: play, warnings: warnings, label: label };
  const oben = baustein(ablauf.oben, "oben", vf.map(function (x) { return x.w; }), 0, ctx);
  const unten = baustein(ablauf.unten, "unten", vf.map(function (x) { return x.l; }), oben.size, ctx);
  const bloecke = [oben, unten];

  const places = [];
  bloecke.forEach(function (b) { Array.prototype.push.apply(places, b.places); });
  places.sort(function (x, y) { return x.place - y.place; });
  places.forEach(function (p) { p.points = p.name ? (punkte(punkteArt)[p.place - 1] || 0) : 0; });
  return {
    vorrunde: vf, bloecke: bloecke, places: places,
    groups: bloecke.filter(function (b) { return b.art === "tabelle"; }),
    complete: bloecke.every(function (b) { return b.complete; }),
  };
}

function baustein(art, seite, slots, offset, ctx) {
  return art === "tabelle"
    ? tabelle(TABELLE_IDS[seite], slots.slice(0, 3), offset, ctx)   // bei 4 Viertelfinals ist das vierte kampflos
    : baum(BAUM_IDS[seite], slots, offset, ctx);
}

// ---------- Baustein Baum: 4 Spieler, Plätze offset+1 bis offset+4 ----------
function baum(ids, s, offset, ctx) {
  const play = ctx.play;
  const h1 = play(ids.halb[0], s[0], s[1]), h2 = play(ids.halb[1], s[2], s[3]);
  const top = play(ids.platz[0], h1.w, h2.w), low = play(ids.platz[1], h1.l, h2.l);
  top.places = [offset + 1, offset + 2];
  low.places = [offset + 3, offset + 4];
  const places = [];
  [top, low].forEach(function (mt) {
    const done = !mt.w.pending;
    places.push({ place: mt.places[0], name: done ? mt.w.name : undefined });
    places.push({ place: mt.places[1], name: done ? mt.l.name : undefined });
  });
  return {
    art: "baum", titel: ids.titel, offset: offset, size: 4, places: places,
    runden: [[h1, h2], [top, low]], finale: ids.platz[0] === "Finale" ? "Finale" : null,
    complete: !top.w.pending && !low.w.pending,
  };
}

// ---------- Baustein Tabelle: drei Spieler, jeder gegen jeden ----------
// Spiel 1 = Platz 0 gegen 1, Spiel 2 = 1 gegen 2, Spiel 3 = 0 gegen 2
function tabelle(ids, slots, offset, ctx) {
  const play = ctx.play;
  const stechen = ctx.day.stechen || {};
  const key = ids.key, title = ids.titel;
  const pairs = [[0, 1], [1, 2], [0, 2]];
  const matches = ids.ids.map(function (id, i) { return play(id, slots[pairs[i][0]], slots[pairs[i][1]]); });
  const g = { art: "tabelle", key: key, title: title, titel: title, offset: offset, size: 3, matches: matches,
    members: [], wins: {}, order: null, tie: false, badStechen: false };
  const finish = function () {
    g.places = [];
    for (let i = 0; i < 3; i++) {
      const place = offset + i + 1;
      let name;
      if (g.order) name = g.order[i] !== undefined ? g.order[i] : null;
      else if (!g.members.length) name = undefined;
      else name = i < g.members.length ? undefined : null;
      g.places.push({ place: place, name: name });
    }
    g.complete = !!g.order;
    return g;
  };
  if (slots.some(function (x) { return x.pending; })) return finish();
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
  if (real.some(function (mt) { return mt.state !== "gespielt"; })) return finish();
  const sorted = g.members.slice().sort(function (a, b) { return g.wins[b] - g.wins[a]; });
  const values = sorted.map(function (n) { return g.wins[n]; });
  const distinct = values.every(function (v, i) { return values.indexOf(v) === i; });
  if (distinct) { g.order = sorted; return finish(); }
  // Gleichstand: Reihenfolge aus dem Stechen
  g.tie = true;
  const st = (Array.isArray(stechen[key]) ? stechen[key] : []).map(clean).filter(Boolean);
  const ok = st.length === g.members.length && g.members.every(function (n) { return st.indexOf(n) >= 0; });
  if (ok) g.order = st;
  else if (st.length) {
    g.badStechen = true;
    ctx.warnings.push(ctx.label + ", " + title + ": Beim Stechen müssen genau diese Spieler stehen: " + g.members.join(", ") + ".");
  }
  return finish();
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
    r.invalidVerlauf.forEach(function (id) { if (day.verlauf) { delete day.verlauf[id]; changed = true; } });
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
  if (day.verlauf && !Object.keys(day.verlauf).length) delete day.verlauf;
  if (day.bonus && !Object.keys(day.bonus).length) delete day.bonus;
}

// Alle Spieltage einer Saison auswerten (ohne Warnungen)
export function resolveAll(days) {
  return days.map(function (d) { return resolveDay(d, []); });
}
