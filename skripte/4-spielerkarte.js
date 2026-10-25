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

// Liefert ein Fenster (dialog) und legt es an, falls es in index.html fehlt
function getDialog(id) {
  let dlg = document.getElementById(id);
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = id;
    document.body.appendChild(dlg);
  }
  return dlg;
}

// Elo-Wert im Kopf der Spielerkarte, z. B. "Elo 1101 ▲37"
function eloBadge(name) {
  const e = lastElo[name];
  if (!e) return null;
  const d = Math.round(e.delta);
  const ranked = Object.keys(lastElo).sort(function (x, y) { return lastElo[y].rating - lastElo[x].rating; });
  return el("span", { class: "elo-badge", title: (ranked.indexOf(name) + 1) + ". der Elo-Wertung · Höchstwert " + Math.round(e.peak) + " · Veränderung seit dem letzten Spieltag" }, [
    document.createTextNode("Elo " + Math.round(e.rating)),
    d ? el("span", { class: d > 0 ? "up" : "down", text: (d > 0 ? " ▲" : " ▼") + Math.abs(d) }) : null,
  ]);
}

function openPlayer(name) {
  const cd = document.getElementById("compare-dialog");
  if (cd && cd.open) cd.close();
  const st = playerStats(name);
  const row = lastRows.filter(function (r) { return r.name === name; })[0];
  const dlg = getDialog("player-dialog");
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
      el("td", { class: "num" }, [el("button", { type: "button", class: "vs-link", text: "vs", title: name + " und " + o.name + " vergleichen",
        onclick: function () { openCompare(name, o.name); } })]),
    ]);
  });

  dlg.appendChild(el("div", { class: "pc" }, [
    el("div", { class: "pc-head" }, [
      el("div", null, [
        el("h2", { text: name }),
                el("p", { class: "sub" }, [
          document.createTextNode(row ? row.rank + ". Platz in der Gesamttabelle" : ""),
          eloBadge(name),
        ]),
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
          el("thead", null, [el("tr", null, [el("th", { text: "Gegner" }), el("th", { class: "num", text: "Spiele" }), el("th", { class: "num", text: "Legs" }), el("th", { class: "num", text: "" })])]),
          el("tbody", null, oppRows),
        ])
      : el("p", { class: "note", text: "Noch keine Spiele." }),
    allPlayerNames().length > 1 ? el("div", { class: "cmp-switch" }, [
      el("span", { class: "note", text: "Vergleichen mit:" }),
      compareSelect(name, null, function (n) { openCompare(name, n); }, "Spieler wählen …"),
    ]) : null,
  ]));
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}

// ---------------------------------------------------------------------
//  Direktvergleich zweier Spieler
// ---------------------------------------------------------------------
function allPlayerNames() {
  return lastRows.map(function (r) { return r.name; });
}

function compareSelect(exclude, selected, onPick, placeholder) {
  const sel = el("select", { class: "cmp-select", "aria-label": placeholder },
    [el("option", { value: "", text: placeholder })].concat(
      allPlayerNames().filter(function (n) { return n !== exclude; }).map(function (n) {
        return el("option", { value: n, text: n, selected: n === selected ? "selected" : null });
      })));
  sel.addEventListener("change", function () { if (sel.value) onPick(sel.value); });
  return sel;
}

// Alle direkten Duelle zwischen a und b, aus Sicht von a
function headToHead(a, b) {
  const list = [];
  lastResolved.forEach(function (d, idx) {
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
        nr: d.nr != null ? d.nr : idx + 1, label: LABELS[id], aWon: mt.winner === a,
        sa: sa, sb: sb, avgA: avgOf(a), avgB: avgOf(b),
      });
    });
  });
  return list;
}

function compareChart(a, histA, b, histB) {
  const days = [];
  lastResolved.forEach(function (d, idx) {
    const nr = d.nr != null ? d.nr : idx + 1;
    const pa = histA.filter(function (h) { return h.nr === nr; })[0];
    const pb = histB.filter(function (h) { return h.nr === nr; })[0];
    if (pa || pb) days.push({ nr: nr, a: pa ? pa.place : null, b: pb ? pb.place : null });
  });
  if (!days.some(function (x) { return x.a !== null || x.b !== null; })) {
    return el("p", { class: "note", text: "Noch keine abgeschlossenen Platzierungen." });
  }
  const W = 320, H = 130, padL = 30, padR = 22, padT = 18, padB = 22, inset = 18;
  const n = days.length;
  const all = days.map(function (x) { return x.a; }).concat(days.map(function (x) { return x.b; })).filter(function (v) { return v !== null; });
  const maxPlace = Math.max(8, Math.max.apply(null, all));
  const x = function (i) { return n === 1 ? (padL + W - padR) / 2 : padL + inset + i * (W - padL - inset - padR) / (n - 1); };
  const y = function (pl) { return padT + (pl - 1) * (H - padT - padB) / (maxPlace - 1); };
  const g = [];
  [1, 4, 8].forEach(function (pl) {
    g.push(svg("line", { x1: padL, x2: W - padR, y1: y(pl), y2: y(pl), class: "grid" }));
    const t = svg("text", { x: padL - 8, y: y(pl) + 4, class: "axis", "text-anchor": "end" }); t.textContent = pl + "."; g.push(t);
  });
  days.forEach(function (dd, i) {
    const lab = svg("text", { x: x(i), y: H - 4, class: "axis", "text-anchor": "middle" }); lab.textContent = "ST " + dd.nr; g.push(lab);
  });
  [["a", "line-a", "dot-a"], ["b", "line-b", "dot-b"]].forEach(function (k) {
    let path = "";
    days.forEach(function (dd, i) {
      if (dd[k[0]] === null) return;
      path += (path ? " L" : "M") + x(i).toFixed(1) + " " + y(dd[k[0]]).toFixed(1);
    });
    if (path.indexOf("L") > 0) g.push(svg("path", { d: path, class: k[1] }));
    days.forEach(function (dd, i) {
      if (dd[k[0]] === null) return;
      g.push(svg("circle", { cx: x(i), cy: y(dd[k[0]]), r: 4.5, class: k[2] }));
    });
  });
  return el("div", null, [
    svg("svg", { viewBox: "0 0 " + W + " " + H, class: "spark cmp-chart", role: "img",
      "aria-label": "Platzierungen: " + days.map(function (dd) {
        return "Spieltag " + dd.nr + ": " + a + " " + (dd.a ? dd.a + "." : "nicht dabei") + ", " + b + " " + (dd.b ? dd.b + "." : "nicht dabei");
      }).join("; ") }, g),
    el("div", { class: "cmp-legend" }, [
      el("span", { class: "key a", text: a }), el("span", { class: "key b", text: b }),
    ]),
  ]);
}

function openCompare(a, b) {
  const pd = document.getElementById("player-dialog");
  if (pd && pd.open) pd.close();
  const dlg = getDialog("compare-dialog");
  dlg.innerHTML = "";

  const sa = playerStats(a), sb = playerStats(b);
  const ra = lastRows.filter(function (r) { return r.name === a; })[0];
  const rb = lastRows.filter(function (r) { return r.name === b; })[0];
  const duels = headToHead(a, b);

  // Kopf
  function side(name, row, cls) {
    return el("div", { class: "cmp-side " + cls }, [
      el("button", { type: "button", class: "player-link cmp-name", text: name, title: "Statistik von " + name,
        onclick: function () { dlg.close(); openPlayer(name); } }),
      el("span", { class: "sub", text: row ? row.rank + ". Platz · " + row.points + " P." : "" }),
    ]);
  }
  const head = el("div", { class: "cmp-head" }, [
    side(a, ra, "a"),
    el("span", { class: "cmp-vs", text: "vs" }),
    side(b, rb, "b"),
    el("button", { type: "button", class: "btn close", text: "✕", "aria-label": "Schließen", onclick: function () { dlg.close(); } }),
  ]);
  const swap = el("div", { class: "cmp-switch" }, [
    el("span", { class: "note", text: "Anderen Gegner wählen:" }),
    compareSelect(a, b, function (n) { openCompare(a, n); }, "Spieler wählen …"),
  ]);

  // Direkte Duelle
  const wa = duels.filter(function (x) { return x.aWon; }).length, wb = duels.length - wa;
  const withLegs = duels.filter(function (x) { return x.sa !== null; });
  const la = withLegs.reduce(function (s, x) { return s + x.sa; }, 0), lb = withLegs.reduce(function (s, x) { return s + x.sb; }, 0);
  let duelBox;
  if (!duels.length) {
    duelBox = el("p", { class: "note", text: "Noch kein direktes Duell." });
  } else {
    duelBox = el("div", null, [
      el("div", { class: "cmp-score" }, [
        el("b", { class: wa > wb ? "lead" : "", text: String(wa) }),
        el("span", { text: ":" }),
        el("b", { class: wb > wa ? "lead" : "", text: String(wb) }),
        withLegs.length ? el("span", { class: "note", text: "Legs " + la + ":" + lb }) : null,
      ]),
      el("table", { class: "mini cmp-duels" }, [el("tbody", null, duels.map(function (x) {
        const res = x.sa !== null ? x.sa + ":" + x.sb : (x.aWon ? "Sieg" : "Niederlage");
        const avgs = (x.avgA !== null || x.avgB !== null) ? "Ø " + fmtAvg(x.avgA) + " / " + fmtAvg(x.avgB) : "";
        return el("tr", null, [
          el("td", { class: "dash", text: "ST " + x.nr }),
          el("td", { text: x.label }),
          el("td", { class: "num " + (x.aWon ? "good" : "bad"), text: res }),
          el("td", { class: "num dash opt-avg", text: avgs }),
        ]);
      }))]),
    ]);
  }

  // Saisonwerte als gegenläufige Balken
  function quote(w, l) { return (w + l) ? w / (w + l) : null; }
  const avgA = sa.avgN ? sa.avgSum / sa.avgN : null, avgB = sb.avgN ? sb.avgSum / sb.avgN : null;
  const ea = lastElo[a], eb = lastElo[b];
  const metrics = [
    ["Elo", ea ? ea.rating : null, eb ? eb.rating : null, function (v) { return String(Math.round(v)); }, true],
    ["Ø Punkte", sa.doneDays ? sa.donePoints / sa.doneDays : null, sb.doneDays ? sb.donePoints / sb.doneDays : null, function (v) { return v.toFixed(1).replace(".", ","); }, true],
    ["Spieltagsiege", sa.history.filter(function (h) { return h.place === 1; }).length, sb.history.filter(function (h) { return h.place === 1; }).length, String, true],
    ["Siegquote", quote(sa.w, sa.l), quote(sb.w, sb.l), function (v) { return Math.round(v * 100) + " %"; }, true],
    ["Leg-Quote", sa.legGames ? quote(sa.lw, sa.ll) : null, sb.legGames ? quote(sb.lw, sb.ll) : null, function (v) { return Math.round(v * 100) + " %"; }, true],
    ["Average", avgA, avgB, fmtAvg, true],
    ["Checkout", quote(sa.coHit, sa.coMiss), quote(sb.coHit, sb.coMiss), function (v) { return Math.round(v * 100) + " %"; }, true],
    ["180er", sa.n180, sb.n180, String, true],
    ["High Finish", sa.hiCo, sb.hiCo, String, true],
    ["Kürzestes Leg", sa.bestLeg, sb.bestLeg, function (v) { return v + " D."; }, false],
  ];
  const bars = el("div", { class: "cmp-bars" }, metrics.map(function (mtr) {
    const va = mtr[1], vb = mtr[2], fmt = mtr[3], higher = mtr[4];
    const has = function (v) { return v !== null && v !== undefined; };
    let pa = 0, pb = 0;
    if (has(va) || has(vb)) {
      if (higher) {
        const mx = Math.max(has(va) ? va : 0, has(vb) ? vb : 0) || 1;
        pa = has(va) ? va / mx : 0; pb = has(vb) ? vb / mx : 0;
      } else {
        // weniger ist besser: kürzester Wert bekommt den vollen Balken
        const mn = Math.min(has(va) ? va : Infinity, has(vb) ? vb : Infinity);
        pa = has(va) ? mn / va : 0; pb = has(vb) ? mn / vb : 0;
      }
    }
    const aBetter = has(va) && (!has(vb) || (higher ? va > vb : va < vb));
    const bBetter = has(vb) && (!has(va) || (higher ? vb > va : vb < va));
    return el("div", { class: "cmp-row" }, [
      el("span", { class: "cmp-val a" + (aBetter ? " better" : ""), text: has(va) ? fmt(va) : "–" }),
      el("span", { class: "cmp-bar a" }, [el("i", { class: aBetter ? "better" : "", style: "width:" + Math.round(pa * 100) + "%" })]),
      el("span", { class: "cmp-label", text: mtr[0] }),
      el("span", { class: "cmp-bar b" }, [el("i", { class: bBetter ? "better" : "", style: "width:" + Math.round(pb * 100) + "%" })]),
      el("span", { class: "cmp-val b" + (bBetter ? " better" : ""), text: has(vb) ? fmt(vb) : "–" }),
    ]);
  }));

  dlg.appendChild(el("div", { class: "pc" }, [
    head,
    ea && eb ? el("div", { class: "cmp-chance" }, [
      el("span", { class: "note", text: "Siegchance im direkten Duell laut Elo" }),
      (function () {
        const pa = Math.round(eloExpected(ea.rating, eb.rating) * 100);
        return el("div", { class: "chance-bar" }, [
          el("span", { class: "chance a", style: "width:" + pa + "%", text: pa + " %" }),
          el("span", { class: "chance b", style: "width:" + (100 - pa) + "%", text: (100 - pa) + " %" }),
        ]);
      })(),
    ]) : null,
    el("h3", { text: "Direkte Duelle" }),
    duelBox,
    el("h3", { text: "Saisonwerte" }),
    bars,
    el("h3", { text: "Platzierungen" }),
    compareChart(a, sa.history, b, sb.history),
    swap,
  ]));
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}