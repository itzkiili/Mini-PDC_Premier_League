// =====================================================================
//  Liga-Seite – Erfolge (wachsende Abzeichen: Bronze, Silber, Gold)
//  Werden über alle Saisons berechnet, bis zur gerade angezeigten.
//  Die Stufen (Grenzwerte) unten in ERFOLGE anpassen.
//
//  art "zahl": wird hochgezählt (z. B. Spieltagsiege)
//  art "wert": ein einzelner Bestwert reicht (z. B. ein Checkout)
// =====================================================================
"use strict";

const STUFEN = ["Bronze", "Silber", "Gold"];
const STUFEN_ICON = ["🥉", "🥈", "🥇"];

function plural(n, eins, mehr) { return n + " " + (n === 1 ? eins : mehr); }

const ERFOLGE = [
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

let achCache = null;          // wird bei jedem render() neu berechnet
let achCacheKey = null;

function erfolg(id) { return ERFOLGE.filter(function (e) { return e.id === id; })[0]; }

// Alle Saisons bis zur angezeigten, älteste zuerst
function seasonsForAchievements() {
  const list = [];
  if (typeof SEASONS !== "undefined" && typeof ARCHIVES !== "undefined") {
    for (let i = 0; i < SEASONS.length; i++) {
      const s = SEASONS[i];
      if (typeof archiveView !== "undefined" && archiveView && archiveView.id === s.id) break;
      if (!ARCHIVES[s.id]) continue;
      list.push({ label: s.name, current: false, resolved: ARCHIVES[s.id].map(function (d) { return resolveDay(d, []); }) });
    }
  }
  list.push({ label: currentSeasonLabel(), current: true, resolved: lastResolved });
  return list;
}

// Ergebnis:
//   got[name][erfolgId]   = [Bronze, Silber, Gold], jeweils { season, current, nr, datum, detail } oder leer
//   count[name][erfolgId] = Zählerstand (bei art "zahl")
function computeAchievements() {
  if (achCache && achCacheKey === lastResolved) return achCache;
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
  achCache = { got: got, count: count };
  achCacheKey = lastResolved;
  return achCache;
}

// Erreichte Stufe: 0 = keine, 1 = Bronze, 2 = Silber, 3 = Gold
function achLevel(stufen) {
  let n = 0;
  (stufen || []).forEach(function (g, i) { if (g) n = i + 1; });
  return n;
}

function achWhen(g) {
  return (g.current ? "" : shortSeason(g.season) + " · ") + "Spieltag " + g.nr + (g.datum ? " · " + g.datum : "");
}

// Abschnitt „Erfolge“ in der Spielerkarte
function achievementsSection(name) {
  const a = computeAchievements();
  const got = a.got[name] || {};
  const cnt = a.count[name] || {};
  let total = 0, max = 0;
  ERFOLGE.forEach(function (e) { total += achLevel(got[e.id]); max += e.stufen.length; });
  return el("div", null, [
    el("h3", { text: "Erfolge · " + total + " von " + max + " Stufen" }),
    el("div", { class: "ach-row" }, ERFOLGE.map(function (e) {
      const st = got[e.id] || [];
      const lvl = achLevel(st);
      // Nur eine Stufe zeigen: die höchste erreichte, sonst die Bronze-Bedingung
      const i = Math.max(lvl - 1, 0), g = st[i];
      let txt = STUFEN_ICON[i] + " " + e.text(e.stufen[i]);
      if (g) txt += " ✓ " + (g.detail ? g.detail + " · " : "") + achWhen(g);
      else if (e.art === "zahl" && cnt[e.id]) txt += " (" + cnt[e.id] + " von " + e.stufen[i] + ")";
      const lines = [el("span", { class: "ach-line" + (g ? " done" : ""), text: txt })];
      const status = lvl ? STUFEN[lvl - 1] : "Noch nicht erreicht";
      // Kleines Abzeichen; Erklärung erscheint beim Darüberfahren (am Handy beim Antippen)
      return el("button", { type: "button", class: "ach lvl" + lvl,
        "aria-label": e.name + ": " + status + ". " + e.text(e.stufen[i]) }, [
        el("span", { class: "ach-icon", text: e.icon, "aria-hidden": "true" }),
        el("span", { class: "ach-tip", "aria-hidden": "true" }, [
          el("b", { text: e.name + (lvl ? " · " + STUFEN[lvl - 1] : "") }),
        ].concat(lines)),
      ]);
    })),
  ]);
}

// Hinweis am Spieltag: wer hier eine neue Stufe geschafft hat (je Erfolg nur die höchste)
function achievementsOfDay(d) {
  const a = computeAchievements();
  const items = [];
  Object.keys(a.got).sort(function (x, y) { return x.localeCompare(y, "de"); }).forEach(function (name) {
    ERFOLGE.forEach(function (e) {
      const st = a.got[name][e.id] || [];
      let best = -1;
      st.forEach(function (g, i) { if (g && g.current && Number(g.nr) === Number(d.nr)) best = i; });
      if (best >= 0) items.push({ name: name, e: e, i: best, g: st[best] });
    });
  });
  if (!items.length) return null;
  return el("div", { class: "ach-day" }, [
    el("span", { class: "ach-day-title", text: "🎉 Neu freigeschaltet" }),
    el("ul", null, items.map(function (it) {
      return el("li", null, [
        nameBtn(it.name),
        document.createTextNode(" " + it.e.icon + " " + it.e.name + " " + STUFEN[it.i] +
          (it.g.detail ? " (" + it.g.detail.replace(/ gegen .*$/, "") + ")" : "")),
      ]);
    })),
  ]);
}