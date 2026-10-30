// =====================================================================
//  Erfolge (wachsende Abzeichen: Bronze, Silber, Gold)
//  Werden über alle Saisons berechnet, bis zur gerade angezeigten.
//  Die Stufen (Grenzwerte) unten in ERFOLGE anpassen.
//
//  art "zahl": wird hochgezählt (z. B. Spieltagsiege)
//  art "wert": ein einzelner Bestwert reicht (z. B. ein Checkout)
// =====================================================================
import { PLAY_ORDER } from "../kern/konstanten.js";
import { toNum, fmtAvg, plural } from "../kern/hilfen.js";
import { state, currentSeasonLabel } from "../kern/zustand.js";
import { earlierSeasons } from "./statistik.js";

export const STUFEN = ["Bronze", "Silber", "Gold"];
export const STUFEN_ICON = ["🥉", "🥈", "🥇"];

export const ERFOLGE = [
  { id: "sieg", icon: "🏆", name: "Sieger", art: "zahl", stufen: [1, 3, 5],
    text: function (n) { return plural(n, "Spieltagsieg", "Spieltagsiege"); } },
  { id: "stamm", icon: "🧱", name: "Stammgast", art: "zahl", stufen: [5, 10, 15],
    text: function (n) { return n + " Spieltage dabei"; } },
  { id: "finish", icon: "🏁", name: "Finisher", art: "wert", stufen: [40, 80, 100],
    text: function (v) { return "Checkout von " + v + " oder mehr"; } },
  { id: "kurz", icon: "⚡", name: "Kurzer Prozess", art: "wert", stufen: [30, 26, 21],
    text: function (v) { return "Leg mit " + v + " Darts oder weniger"; } },
  { id: "avg", icon: "📊", name: "Scorer", art: "wert", stufen: [45, 50, 55],
    text: function (v) { return "Average von " + v + " oder mehr in einem Spiel"; } },
  { id: "doppel", icon: "🎯", name: "Doppelkönig", art: "wert", stufen: [20, 30, 40],
    text: function (v) { return "Checkout-Quote über " + v + " % in einem Spiel"; } },
  { id: "nerven", icon: "💪", name: "Nervenstark", art: "zahl", stufen: [1, 5, 10],
    text: function (n) { return plural(n, "Entscheidungsleg", "Entscheidungslegs") + " gewonnen"; } },
  { id: "bonus", icon: "🎁", name: "Bonusjäger", art: "zahl", stufen: [1, 5, 10],
    text: function (n) { return plural(n, "Bonuspunkt", "Bonuspunkte"); } },
  { id: "pech", icon: "💔", name: "Unglücklich", art: "zahl", stufen: [1, 3, 5],
    text: function (n) { return n + "× Platz 2 an einem Spieltag"; } },
];

function erfolg(id) { return ERFOLGE.filter(function (e) { return e.id === id; })[0]; }

// Erreichte Stufe: 0 = keine, 1 = Bronze, 2 = Silber, 3 = Gold
export function achLevel(stufen) {
  let n = 0;
  (stufen || []).forEach(function (g, i) { if (g) n = i + 1; });
  return n;
}

// Alle Saisons bis zur angezeigten, älteste zuerst
function seasonsForAchievements() {
  return earlierSeasons().map(function (x) {
    return { label: x.season.name, current: false, resolved: x.resolved };
  }).concat([{ label: currentSeasonLabel(), current: true, resolved: state.resolved }]);
}

// Wird nur neu berechnet, wenn sich die Spieltage geändert haben (neues render)
let cache = null;
let cacheKey = null;

// Ergebnis:
//   got[name][erfolgId]   = [Bronze, Silber, Gold], jeweils { season, current, nr, datum, detail } oder leer
//   count[name][erfolgId] = Zählerstand (bei art "zahl")
export function computeAchievements() {
  if (cache && cacheKey === state.resolved) return cache;
  const got = {}, count = {};
  const slot = function (name, id) {
    const p = got[name] || (got[name] = {});
    return p[id] || (p[id] = [null, null, null]);
  };
  const mark = function (name, id, i, s, d, detail) {
    const st = slot(name, id);
    if (!st[i]) st[i] = { season: s.label, current: s.current, nr: d.nr, datum: d.datum || "", detail: detail || "" };
  };
  // art "zahl": hochzählen, bei Erreichen einer Stufe merken
  const add = function (name, id, by, s, d) {
    if (!name || !by) return;
    const c = count[name] || (count[name] = {});
    c[id] = (c[id] || 0) + by;
    erfolg(id).stufen.forEach(function (ziel, i) { if (c[id] >= ziel) mark(name, id, i, s, d, ""); });
  };
  // art "wert": jede Stufe, die dieser Wert schafft
  const reach = function (name, id, ok, s, d, detail) {
    if (!name) return;
    erfolg(id).stufen.forEach(function (ziel, i) { if (ok(ziel)) mark(name, id, i, s, d, detail); });
  };

  seasonsForAchievements().forEach(function (s) {
    s.resolved.forEach(function (d) {
      d.players.forEach(function (name) {
        if (!name) return;
        add(name, "stamm", 1, s, d);
        const bp = d.bonus && d.bonus.per[name];
        if (bp && bp.co > 0) reach(name, "finish", function (z) { return bp.co >= z; }, s, d, String(bp.co));
        if (bp && bp.leg > 0) reach(name, "kurz", function (z) { return bp.leg <= z; }, s, d, bp.leg + " Darts");
        if (d.bonus) add(name, "bonus", d.bonus.pointsOf(name), s, d);
      });
      d.places.forEach(function (pl) {
        if (pl.place === 1 && pl.name) add(pl.name, "sieg", 1, s, d);
        if (pl.place === 2 && pl.name) add(pl.name, "pech", 1, s, d);
      });
      PLAY_ORDER.forEach(function (id) {
        const mt = d.matches[id];
        if (!mt || mt.state !== "gespielt") return;
        const an = mt.a.name, bn = mt.b.name;
        if (mt.score && mt.winner) {
          const sa = mt.score.a, sb = mt.score.b;
          if (Math.abs(sa - sb) === 1 && Math.min(sa, sb) > 0) add(mt.winner, "nerven", 1, s, d);
        }
        if (!mt.stats) return;
        [an, bn].forEach(function (name) {
          const ps = name && mt.stats[name];
          if (!ps) return;
          const opp = name === an ? bn : an;
          const avg = toNum(ps.avg), miss = toNum(ps.miss);
          if (avg !== null) reach(name, "avg", function (z) { return avg >= z; }, s, d, fmtAvg(avg) + " gegen " + opp);
          if (miss !== null && mt.score) {
            const hit = name === an ? mt.score.a : mt.score.b;
            const q = hit > 0 ? hit / (hit + miss) * 100 : 0;
            if (q > 0) reach(name, "doppel", function (z) { return q > z; }, s, d, Math.round(q) + " % gegen " + opp);
          }
        });
      });
    });
  });
  cache = { got: got, count: count };
  cacheKey = state.resolved;
  return cache;
}
