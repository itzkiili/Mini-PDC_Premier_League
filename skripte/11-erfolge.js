// =====================================================================
//  Liga-Seite – Erfolge (Abzeichen)
//  Werden über alle Saisons berechnet, bis zur gerade angezeigten.
//  Grenzwerte unten in ERFOLGE anpassen.
// =====================================================================
"use strict";

const ERFOLGE = [
  { id: "sieg",    icon: "🥇", name: "Erster Sieg",     text: "Einen Spieltag gewonnen" },
  { id: "stamm",   icon: "🧱", name: "Stammgast",       text: "An 7 Spieltagen dabei", ziel: 7 },
  { id: "ton",     icon: "🏁", name: "Ton-Plus-Finish", text: "Checkout von 100 oder mehr", ab: 100 },
  { id: "kurz",    icon: "⚡", name: "Kurzer Prozess",  text: "Leg mit 21 Darts oder weniger", bis: 21 },
  { id: "sechzig", icon: "📊", name: "Sechziger-Club",  text: "Average von 60 oder mehr in einem Spiel", ab: 60 },
  { id: "doppel",  icon: "🎯", name: "Doppelkönig",     text: "Checkout-Quote über 40 % in einem Spiel", ueber: 0.4 },
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

// Ergebnis: { name: { erfolgId: { season, current, nr, datum, detail } } } – jeweils das erste Mal
function computeAchievements() {
  const key = lastResolved;
  if (achCache && achCacheKey === key) return achCache;
  const res = {}, count = {};
  const give = function (name, id, s, d, detail) {
    if (!name) return;
    const p = res[name] || (res[name] = {});
    if (p[id]) return;
    p[id] = { season: s.label, current: s.current, nr: d.nr, datum: d.datum || "", detail: detail || "" };
  };
  seasonsForAchievements().forEach(function (s) {
    s.resolved.forEach(function (d) {
      d.players.forEach(function (name) {
        if (!name) return;
        count[name] = (count[name] || 0) + 1;
        if (count[name] === erfolg("stamm").ziel) give(name, "stamm", s, d, "");
        const bp = d.bonus && d.bonus.per[name];
        if (bp && bp.co >= erfolg("ton").ab) give(name, "ton", s, d, String(bp.co));
        if (bp && bp.leg > 0 && bp.leg <= erfolg("kurz").bis) give(name, "kurz", s, d, bp.leg + " Darts");
      });
      d.places.forEach(function (pl) { if (pl.place === 1 && pl.name) give(pl.name, "sieg", s, d, ""); });
      PLAY_ORDER.forEach(function (id) {
        const mt = d.matches[id];
        if (!mt || mt.state !== "gespielt" || !mt.stats) return;
        [mt.a.name, mt.b.name].forEach(function (name) {
          const ps = name && mt.stats[name];
          if (!ps) return;
          const opp = name === mt.a.name ? mt.b.name : mt.a.name;
          const avg = toNum(ps.avg), miss = toNum(ps.miss);
          if (avg !== null && avg >= erfolg("sechzig").ab) give(name, "sechzig", s, d, fmtAvg(avg) + " gegen " + opp);
          if (miss !== null && mt.score) {
            const hit = name === mt.a.name ? mt.score.a : mt.score.b;
            if (hit > 0 && hit / (hit + miss) > erfolg("doppel").ueber) {
              give(name, "doppel", s, d, Math.round(hit / (hit + miss) * 100) + " % gegen " + opp);
            }
          }
        });
      });
    });
  });
  achCache = { got: res, count: count };
  achCacheKey = key;
  return achCache;
}

function achWhen(g) {
  return (g.current ? "" : shortSeason(g.season) + " · ") + "Spieltag " + g.nr + (g.datum ? " · " + g.datum : "");
}

// Abschnitt „Erfolge“ in der Spielerkarte
function achievementsSection(name) {
  const a = computeAchievements();
  const got = a.got[name] || {};
  const n = ERFOLGE.filter(function (e) { return got[e.id]; }).length;
  return el("div", null, [
    el("h3", { text: "Erfolge · " + n + " von " + ERFOLGE.length }),
    el("div", { class: "ach-row" }, ERFOLGE.map(function (e) {
      const g = got[e.id];
      let status;
      if (g) status = "✓ " + (g.detail ? g.detail + " · " : "") + achWhen(g);
      else if (e.ziel) status = "Noch nicht erreicht (" + Math.min(a.count[name] || 0, e.ziel) + " von " + e.ziel + ")";
      else status = "Noch nicht erreicht";
      // Kleines Abzeichen; Erklärung erscheint beim Darüberfahren (am Handy beim Antippen)
      return el("button", { type: "button", class: "ach" + (g ? " got" : ""),
        "aria-label": e.name + ": " + e.text + ". " + status }, [
        el("span", { class: "ach-icon", text: e.icon, "aria-hidden": "true" }),
        el("span", { class: "ach-tip", "aria-hidden": "true" }, [
          el("b", { text: e.name }),
          el("span", { text: e.text }),
          el("span", { class: "ach-status", text: status }),
        ]),
      ]);
    })),
  ]);
}

// Hinweis am Spieltag: wer hier etwas zum ersten Mal geschafft hat
function achievementsOfDay(d) {
  const a = computeAchievements();
  const items = [];
  Object.keys(a.got).sort(function (x, y) { return x.localeCompare(y, "de"); }).forEach(function (name) {
    ERFOLGE.forEach(function (e) {
      const g = a.got[name][e.id];
      if (g && g.current && Number(g.nr) === Number(d.nr)) items.push({ name: name, e: e, g: g });
    });
  });
  if (!items.length) return null;
  return el("div", { class: "ach-day" }, [
    el("span", { class: "ach-day-title", text: "🎉 Neu freigeschaltet" }),
    el("ul", null, items.map(function (it) {
      return el("li", null, [
        nameBtn(it.name),
        document.createTextNode(" " + it.e.icon + " " + it.e.name + (it.g.detail ? " (" + it.g.detail.replace(/ gegen .*$/, "") + ")" : "")),
      ]);
    })),
  ]);
}