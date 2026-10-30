// =====================================================================
//  Direktvergleich zweier Spieler: Siegchance, direkte Duelle,
//  Saisonwerte als Balken und gemeinsamer Platzierungsverlauf
// =====================================================================
import { el, svg, getDialog, openDialog, closeDialog, closeButton } from "../kern/dom.js";
import { fmtAvg, shortSeason } from "../kern/hilfen.js";
import { state } from "../kern/zustand.js";
import { playerStats, headToHeadSeason, headToHeadAll } from "../auswertung/statistik.js";
import { duelChance } from "../auswertung/elo.js";
import { openPlayer, chartFrame, svgText, CHART } from "./spielerkarte.js";

const DUELS_SHOWN = 5;          // so viele Duelle werden zunächst angezeigt
let compareScope = "alle";      // "alle" Saisons oder nur "saison"
let compareAllDuels = false;    // alle Duelle aufgeklappt?
let comparePair = "";

export function allPlayerNames() {
  return state.rows.map(function (r) { return r.name; });
}

// Auswahlliste mit allen Spielern außer `exclude`
export function compareSelect(exclude, selected, onPick, placeholder) {
  const sel = el("select", { class: "cmp-select", "aria-label": placeholder },
    [el("option", { value: "", text: placeholder })].concat(
      allPlayerNames().filter(function (n) { return n !== exclude; }).map(function (n) {
        return el("option", { value: n, text: n, selected: n === selected ? "selected" : null });
      })));
  sel.addEventListener("change", function () { if (sel.value) onPick(sel.value); });
  return sel;
}

export function openCompare(a, b) {
  closeDialog("player-dialog");
  const dlg = getDialog("compare-dialog");
  dlg.innerHTML = "";

  // Anderes Spielerpaar: wieder nur die letzten Duelle zeigen
  if (comparePair !== a + "|" + b) { comparePair = a + "|" + b; compareAllDuels = false; }

  const sa = playerStats(a), sb = playerStats(b);
  const duelsSeason = headToHeadSeason(a, b);
  const duelsAll = headToHeadAll(a, b);
  const multiSeason = duelsAll.length > duelsSeason.length;
  const ea = state.elo[a], eb = state.elo[b];

  dlg.appendChild(el("div", { class: "pc" }, [
    compareHead(dlg, a, b),
    ea && eb ? chanceBox(ea, eb, duelsAll, multiSeason) : null,
    el("h3", { text: "Direkte Duelle" }),
    duelBox(a, b, duelsSeason, duelsAll, multiSeason),
    el("h3", { text: "Saisonwerte" }),
    seasonBars(a, b, sa, sb),
    el("h3", { text: "Platzierungen" }),
    compareChart(a, sa.history, b, sb.history),
    el("div", { class: "cmp-switch" }, [
      el("span", { class: "note", text: "Anderen Gegner wählen:" }),
      compareSelect(a, b, function (n) { openCompare(a, n); }, "Spieler wählen …"),
    ]),
  ]));
  openDialog(dlg);
}

// ---------- Kopf: beide Namen mit Tabellenplatz ----------
function compareHead(dlg, a, b) {
  function side(name, cls) {
    const row = state.rows.filter(function (r) { return r.name === name; })[0];
    return el("div", { class: "cmp-side " + cls }, [
      el("button", { type: "button", class: "player-link cmp-name", text: name, title: "Statistik von " + name,
        onclick: function () { dlg.close(); openPlayer(name); } }),
      el("span", { class: "sub", text: row ? row.rank + ". Platz · " + row.points + " P." : "" }),
    ]);
  }
  return el("div", { class: "cmp-head" }, [
    side(a, "a"),
    el("span", { class: "cmp-vs", text: "vs" }),
    side(b, "b"),
    closeButton(dlg),
  ]);
}

// ---------- Siegchance ----------
function chanceBox(ea, eb, duelsAll, multiSeason) {
  const ch = duelChance(ea, eb, duelsAll);
  const pa = Math.round(ch.p * 100);
  const detail = "Elo " + Math.round(ch.pElo * 100) + " %" +
    (ch.n ? " · direkte Duelle" + (multiSeason ? " (alle Saisons) " : " ") + ch.wins + ":" + (ch.n - ch.wins) + (ch.legs ? " (Legs " + ch.lw + ":" + ch.ll + ")" : "") +
      " · Duelle zählen zu " + Math.round(ch.weight * 100) + " %" : " · noch kein direktes Duell");
  return el("div", { class: "cmp-chance" }, [
    el("span", { class: "note", text: "Siegchance im direkten Duell" }),
    chanceBar(pa),
    el("span", { class: "note small", text: detail }),
  ]);
}

// Balken „62 % | 38 %“ (auch für „Nächstes Spiel“)
export function chanceBar(pa, attrs) {
  return el("div", Object.assign({ class: "chance-bar" }, attrs || {}), [
    el("span", { class: "chance a", style: "width:" + pa + "%", text: pa + " %" }),
    el("span", { class: "chance b", style: "width:" + (100 - pa) + "%", text: (100 - pa) + " %" }),
  ]);
}

// ---------- Direkte Duelle ----------
function duelBox(a, b, duelsSeason, duelsAll, multiSeason) {
  const showAll = multiSeason && compareScope === "alle";
  const duels = showAll ? duelsAll : duelsSeason;
  const scopeToggle = multiSeason ? el("div", { class: "scope-toggle", role: "group", "aria-label": "Zeitraum der Duelle" }, [
    el("button", { type: "button", class: showAll ? "on" : "", "aria-pressed": showAll ? "true" : "false",
      text: "Alle Saisons (" + duelsAll.length + ")", onclick: function () { compareScope = "alle"; openCompare(a, b); } }),
    el("button", { type: "button", class: showAll ? "" : "on", "aria-pressed": showAll ? "false" : "true",
      text: "Diese Saison (" + duelsSeason.length + ")", onclick: function () { compareScope = "saison"; openCompare(a, b); } }),
  ]) : null;
  if (!duels.length) {
    return el("div", null, [scopeToggle, el("p", { class: "note", text: showAll || !multiSeason ? "Noch kein direktes Duell." : "In dieser Saison noch kein direktes Duell." })]);
  }

  const wa = duels.filter(function (x) { return x.aWon; }).length, wb = duels.length - wa;
  const withLegs = duels.filter(function (x) { return x.sa !== null; });
  const la = withLegs.reduce(function (s, x) { return s + x.sa; }, 0), lb = withLegs.reduce(function (s, x) { return s + x.sb; }, 0);
  // Neueste zuerst, standardmäßig nur die letzten DUELS_SHOWN
  const newestFirst = duels.slice().reverse();
  const shownDuels = compareAllDuels ? newestFirst : newestFirst.slice(0, DUELS_SHOWN);

  return el("div", null, [
    scopeToggle,
    el("div", { class: "cmp-score" }, [
      el("b", { class: wa > wb ? "lead" : "", text: String(wa) }),
      el("span", { text: ":" }),
      el("b", { class: wb > wa ? "lead" : "", text: String(wb) }),
      withLegs.length ? el("span", { class: "note", text: "Legs " + la + ":" + lb }) : null,
    ]),
    el("table", { class: "mini cmp-duels" }, [el("tbody", null, shownDuels.map(function (x) {
      const res = x.sa !== null ? x.sa + ":" + x.sb : (x.aWon ? "Sieg" : "Niederlage");
      const avgs = (x.avgA !== null || x.avgB !== null) ? "Ø " + fmtAvg(x.avgA) + " / " + fmtAvg(x.avgB) : "";
      return el("tr", null, [
        el("td", { class: "dash", text: (showAll ? shortSeason(x.season) + " · " : "") + "ST " + x.nr }),
        el("td", { text: x.label }),
        el("td", { class: "num " + (x.aWon ? "good" : "bad"), text: res }),
        el("td", { class: "num dash opt-avg", text: avgs }),
      ]);
    }))]),
    duels.length > DUELS_SHOWN ? el("button", { type: "button", class: "linkbtn more-duels",
      text: compareAllDuels ? "Nur die letzten " + DUELS_SHOWN + " anzeigen" : "Alle " + duels.length + " Duelle anzeigen",
      onclick: function () { compareAllDuels = !compareAllDuels; openCompare(a, b); } }) : null,
  ]);
}

// ---------- Saisonwerte als gegenläufige Balken ----------
function quote(w, l) { return (w + l) ? w / (w + l) : null; }
function percent(v) { return Math.round(v * 100) + " %"; }

function seasonBars(a, b, sa, sb) {
  const ea = state.elo[a], eb = state.elo[b];
  const wins = function (st) { return st.history.filter(function (h) { return h.place === 1; }).length; };
  // [Bezeichnung, Wert a, Wert b, Format, mehr ist besser?]
  const metrics = [
    ["Elo", ea ? ea.rating : null, eb ? eb.rating : null, function (v) { return String(Math.round(v)); }, true],
    ["Ø Punkte", sa.doneDays ? sa.donePoints / sa.doneDays : null, sb.doneDays ? sb.donePoints / sb.doneDays : null, function (v) { return v.toFixed(1).replace(".", ","); }, true],
    ["Spieltagsiege", wins(sa), wins(sb), String, true],
    ["Siegquote", quote(sa.w, sa.l), quote(sb.w, sb.l), percent, true],
    ["Leg-Quote", sa.legGames ? quote(sa.lw, sa.ll) : null, sb.legGames ? quote(sb.lw, sb.ll) : null, percent, true],
    ["Average", sa.avgN ? sa.avgSum / sa.avgN : null, sb.avgN ? sb.avgSum / sb.avgN : null, fmtAvg, true],
    ["Checkout", quote(sa.coHit, sa.coMiss), quote(sb.coHit, sb.coMiss), percent, true],
    ["180er", sa.n180, sb.n180, String, true],
    ["High Finish", sa.hiCo, sb.hiCo, String, true],
    ["Kürzestes Leg", sa.bestLeg, sb.bestLeg, function (v) { return v + " D."; }, false],
  ];
  return el("div", { class: "cmp-bars" }, metrics.map(function (mtr) {
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
}

// ---------- Platzierungsverlauf beider Spieler ----------
function compareChart(a, histA, b, histB) {
  const days = [];
  state.resolved.forEach(function (d, idx) {
    const nr = d.nr != null ? d.nr : idx + 1;
    const pa = histA.filter(function (h) { return h.nr === nr; })[0];
    const pb = histB.filter(function (h) { return h.nr === nr; })[0];
    if (pa || pb) days.push({ nr: nr, a: pa ? pa.place : null, b: pb ? pb.place : null });
  });
  if (!days.some(function (x) { return x.a !== null || x.b !== null; })) {
    return el("p", { class: "note", text: "Noch keine abgeschlossenen Platzierungen." });
  }
  const all = days.map(function (x) { return x.a; }).concat(days.map(function (x) { return x.b; })).filter(function (v) { return v !== null; });
  const f = chartFrame(days.length, Math.max(8, Math.max.apply(null, all)));
  const g = f.grid;
  days.forEach(function (dd, i) {
    g.push(svgText({ x: f.x(i), y: CHART.H - 4, class: "axis", "text-anchor": "middle" }, "ST " + dd.nr));
  });
  [["a", "line-a", "dot-a"], ["b", "line-b", "dot-b"]].forEach(function (k) {
    let path = "";
    days.forEach(function (dd, i) {
      if (dd[k[0]] === null) return;
      path += (path ? " L" : "M") + f.x(i).toFixed(1) + " " + f.y(dd[k[0]]).toFixed(1);
    });
    if (path.indexOf("L") > 0) g.push(svg("path", { d: path, class: k[1] }));
    days.forEach(function (dd, i) {
      if (dd[k[0]] === null) return;
      g.push(svg("circle", { cx: f.x(i), cy: f.y(dd[k[0]]), r: 4.5, class: k[2] }));
    });
  });
  return el("div", null, [
    svg("svg", { viewBox: "0 0 " + CHART.W + " " + CHART.H, class: "spark cmp-chart", role: "img",
      "aria-label": "Platzierungen: " + days.map(function (dd) {
        return "Spieltag " + dd.nr + ": " + a + " " + (dd.a ? dd.a + "." : "nicht dabei") + ", " + b + " " + (dd.b ? dd.b + "." : "nicht dabei");
      }).join("; ") }, g),
    el("div", { class: "cmp-legend" }, [
      el("span", { class: "key a", text: a }), el("span", { class: "key b", text: b }),
    ]),
  ]);
}
