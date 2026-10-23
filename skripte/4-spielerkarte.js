// =====================================================================
//  Liga-Seite – Statistiken und Spielerkarte
// =====================================================================
"use strict";

// ===================================================================
//  Spielerkarte
// ===================================================================
const PLAY_ORDER = ["VF1", "VF2", "VF3", "VF4", "PR1", "PR2", "HF1", "HF2", "P7", "P5", "P3", "Finale",
  "G1", "V1", "G2", "V2", "G3", "V3"];
const SVGNS = "http://www.w3.org/2000/svg";
function svg(tag, attrs, children) {
  const e = document.createElementNS(SVGNS, tag);
  Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  (children || []).forEach(function (c) { if (c) e.appendChild(c); });
  return e;
}
function nameBtn(name) {
  return el("button", { type: "button", class: "player-link", text: name, title: "Statistik von " + name,
    onclick: function () { openPlayer(name); } });
}
function pct(a, b) { return b ? Math.round((a / b) * 100) + " %" : "–"; }
function toNum(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).trim().replace(",", "."));
  return isFinite(n) ? n : null;
}
function fmtAvg(n) { return n === null || n === undefined ? "–" : n.toFixed(2).replace(".", ","); }

// Average / Missed Doubles eines Spielers aus einem Spiel sammeln
function addMatchStats(acc, mt, name) {
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
}
function newAcc(o) { o.avgSum = 0; o.avgN = 0; o.bestAvg = null; o.coHit = 0; o.coMiss = 0; return o; }

function playerStats(name) {
  const st = {
    name: name, days: 0, doneDays: 0, points: 0, best: null, bestCount: 0,
    w: 0, l: 0, lw: 0, ll: 0, legGames: 0, dec: 0, decW: 0, nil: 0,
    avgSum: 0, avgN: 0, bestAvg: null, coHit: 0, coMiss: 0,
    bonus: 0, donePoints: 0, n180: 0, hiCo: null, bestLeg: null, coTops: 0, legTops: 0, days180: 0,
    history: [], results: [], opp: {},
  };
  lastResolved.forEach(function (d, idx) {
    if (d.players.indexOf(name) < 0) return;
    st.days++;
    const pl = d.places.filter(function (p) { return p.name === name; })[0];
    st.history.push({ nr: d.nr != null ? d.nr : idx + 1, place: pl ? pl.place : null });
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
    if (pl) {
      st.doneDays++;
      st.points += pl.points;
      st.donePoints += pl.points + bpts;
      if (st.best === null || pl.place < st.best) { st.best = pl.place; st.bestCount = 1; }
      else if (pl.place === st.best) st.bestCount++;
    }
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
  // aktuelle Serie
  let streak = 0, streakWin = null;
  for (let i = st.results.length - 1; i >= 0; i--) {
    if (streakWin === null) streakWin = st.results[i];
    if (st.results[i] !== streakWin) break;
    streak++;
  }
  st.streak = streak; st.streakWin = streakWin;
  // Lieblings- und Angstgegner
  const opps = Object.keys(st.opp).map(function (k) { return st.opp[k]; });
  opps.sort(function (a, b) { return (b.w - b.l) - (a.w - a.l) || (b.w + b.l) - (a.w + a.l) || a.name.localeCompare(b.name, "de"); });
  st.opps = opps;
  const fav = opps.filter(function (o) { return o.w > o.l; })[0];
  const nem = opps.slice().reverse().filter(function (o) { return o.l > o.w; })
    .sort(function (a, b) { return (a.w - a.l) - (b.w - b.l) || (b.w + b.l) - (a.w + a.l); })[0];
  st.fav = fav || null; st.nem = nem || null;
  return st;
}

function sparkline(history) {
  const pts = history.filter(function (h) { return h.place !== null; });
  if (pts.length === 0) return el("p", { class: "note", text: "Noch keine abgeschlossene Platzierung." });
  const W = 320, H = 130, padL = 30, padR = 22, padT = 18, padB = 22, inset = 18;
  const maxPlace = Math.max(8, Math.max.apply(null, pts.map(function (p) { return p.place; })));
  const n = history.length;
  const x = function (i) { return n === 1 ? (padL + W - padR) / 2 : padL + inset + i * (W - padL - inset - padR) / (n - 1); };
  const y = function (pl) { return padT + (pl - 1) * (H - padT - padB) / (maxPlace - 1); };
  const g = [];
  [1, 4, 8].forEach(function (pl) {
    g.push(svg("line", { x1: padL, x2: W - padR, y1: y(pl), y2: y(pl), class: "grid" }));
    const t = svg("text", { x: padL - 8, y: y(pl) + 4, class: "axis", "text-anchor": "end" }); t.textContent = pl + "."; g.push(t);
  });
  let path = "";
  history.forEach(function (h, i) {
    if (h.place === null) return;
    path += (path ? " L" : "M") + x(i).toFixed(1) + " " + y(h.place).toFixed(1);
  });
  if (pts.length > 1) g.push(svg("path", { d: path, class: "line" }));
  history.forEach(function (h, i) {
    const lab = svg("text", { x: x(i), y: H - 4, class: "axis", "text-anchor": "middle" }); lab.textContent = "ST " + h.nr; g.push(lab);
    if (h.place === null) return;
    g.push(svg("circle", { cx: x(i), cy: y(h.place), r: 4.5, class: "dot" + (h.place === 1 ? " gold" : "") }));
    const t = svg("text", { x: x(i), y: y(h.place) - 9, class: "val", "text-anchor": "middle" }); t.textContent = h.place + "."; g.push(t);
  });
  const s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "spark", role: "img",
    "aria-label": "Platzierungen: " + history.map(function (h) { return "Spieltag " + h.nr + " Platz " + (h.place || "offen"); }).join(", ") }, g);
  return s;
}

function tile(label, value, sub) {
  return el("div", { class: "tile" }, [
    el("span", { class: "tile-label", text: label }),
    el("b", { text: value }),
    sub ? el("span", { class: "tile-sub", text: sub }) : null,
  ]);
}

function openPlayer(name) {
  const st = playerStats(name);
  const row = lastRows.filter(function (r) { return r.name === name; })[0];
  const dlg = document.getElementById("player-dialog");
  dlg.innerHTML = "";
  const avg = st.doneDays ? (st.donePoints / st.doneDays).toFixed(1).replace(".", ",") : "–";
  const diff = st.lw - st.ll;

  const tiles = el("div", { class: "tiles" }, [
    tile("Punkte", String(st.points), st.days + (st.days === 1 ? " Spieltag" : " Spieltage")),
    tile("Ø Punkte", avg, "pro Spieltag"),
    tile("Beste Platzierung", st.best ? st.best + "." : "–", st.best ? st.bestCount + "×" : null),
    tile("Spiele", st.w + "–" + st.l, "Siegquote " + pct(st.w, st.w + st.l)),
    tile("Legs", st.legGames ? st.lw + ":" + st.ll : "–", st.legGames ? (diff > 0 ? "+" : "") + diff + " · " + pct(st.lw, st.lw + st.ll) : "noch keine Legs"),
    tile("Entscheidungslegs", st.dec ? st.decW + " von " + st.dec : "–", st.dec ? "gewonnen (" + pct(st.decW, st.dec) + ")" : "z. B. 3:2"),
    tile("Average", st.avgN ? fmtAvg(st.avgSum / st.avgN) : "–", st.avgN ? "Bester: " + fmtAvg(st.bestAvg) : "noch nicht erfasst"),
    tile("Checkout-Quote", (st.coHit + st.coMiss) ? pct(st.coHit, st.coHit + st.coMiss) : "–",
      (st.coHit + st.coMiss) ? st.coHit + " von " + (st.coHit + st.coMiss) + " Doppeln" : "noch nicht erfasst"),
    tile("Bonuspunkte", st.bonus ? "+" + st.bonus : "–", "in den Punkten enthalten"),
    tile("180er", String(st.n180), st.n180 ? "an " + st.days180 + (st.days180 === 1 ? " Spieltag" : " Spieltagen") : "noch keine"),
    tile("Höchstes Finish", st.hiCo ? String(st.hiCo) : "–", st.coTops ? st.coTops + "× Tagesbestwert" : (st.hiCo ? "Saison-Bestwert" : "noch nicht erfasst")),
    tile("Kürzestes Leg", st.bestLeg ? st.bestLeg + " Darts" : "–", st.legTops ? st.legTops + "× Tagesbestwert" : (st.bestLeg ? "Saison-Bestwert" : "noch nicht erfasst")),
  ]);

  const facts = [];
  if (st.streak >= 2) facts.push((st.streakWin ? "🔥 " : "") + st.streak + (st.streakWin ? " Siege" : " Niederlagen") + " in Folge");
  if (st.nil) facts.push(st.nil + (st.nil === 1 ? " Sieg" : " Siege") + " zu null");
  if (st.fav) facts.push("Lieblingsgegner: " + st.fav.name + " (" + st.fav.w + "–" + st.fav.l + ")");
  if (st.nem) facts.push("Angstgegner: " + st.nem.name + " (" + st.nem.w + "–" + st.nem.l + ")");

  const oppRows = st.opps.map(function (o) {
    return el("tr", null, [
      el("td", null, [nameBtn(o.name)]),
      el("td", { class: "num" + (o.w > o.l ? " good" : o.l > o.w ? " bad" : ""), text: o.w + "–" + o.l }),
      el("td", { class: "num dash", text: o.legs ? o.lw + ":" + o.ll : "" }),
    ]);
  });

  dlg.appendChild(el("div", { class: "pc" }, [
    el("div", { class: "pc-head" }, [
      el("div", null, [
        el("h2", { text: name }),
        el("p", { class: "sub", text: row ? row.rank + ". Platz in der Gesamttabelle" : "" }),
      ]),
      el("button", { type: "button", class: "btn close", text: "✕", "aria-label": "Schließen", onclick: function () { dlg.close(); } }),
    ]),
    tiles,
    facts.length ? el("ul", { class: "facts" }, facts.map(function (f) { return el("li", { text: f }); })) : null,
    el("h3", { text: "Platzierungen" }),
    sparkline(st.history),
    el("h3", { text: "Bilanz gegen Gegner" }),
    oppRows.length
      ? el("table", { class: "mini opp" }, [
          el("thead", null, [el("tr", null, [el("th", { text: "Gegner" }), el("th", { class: "num", text: "Spiele" }), el("th", { class: "num", text: "Legs" })])]),
          el("tbody", null, oppRows),
        ])
      : el("p", { class: "note", text: "Noch keine Spiele." }),
  ]));
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}
