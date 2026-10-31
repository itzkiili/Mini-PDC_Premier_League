// =====================================================================
//  Spielerkarte: Statistik, Platzierungsverlauf, Bilanz gegen jeden Gegner
// =====================================================================
import { el, svg, getDialog, openDialog, closeDialog, closeButton } from "../kern/dom.js";
import { fmtAvg, pct } from "../kern/hilfen.js";
import { state } from "../kern/zustand.js";
import { playerStats } from "../auswertung/statistik.js";
import { openCompare, compareSelect, allPlayerNames } from "./vergleich.js";
import { achievementsSection } from "./erfolge.js";
import { profileAvatar, profileInfo } from "./profil.js";

// Name als Knopf, der die Spielerkarte öffnet
export function nameBtn(name) {
  return el("button", { type: "button", class: "player-link", text: name, title: "Statistik von " + name,
    onclick: function () { openPlayer(name); } });
}

export function openPlayer(name) {
  closeDialog("compare-dialog");
  const st = playerStats(name);
  const row = state.rows.filter(function (r) { return r.name === name; })[0];
  const dlg = getDialog("player-dialog");
  dlg.innerHTML = "";

  dlg.appendChild(el("div", { class: "pc" }, [
    el("div", { class: "pc-head" }, [
      profileAvatar(name),
      el("div", { class: "pc-title" }, [
        el("h2", { text: name }),
        profileInfo(name),
        el("p", { class: "sub" }, [
          document.createTextNode(row ? row.rank + ". Platz in der Gesamttabelle" : ""),
          eloBadge(name),
        ]),
      ]),
      closeButton(dlg),
    ]),
    statTiles(st),
    factList(st),
    achievementsSection(name),
    el("h3", { text: "Platzierungen" }),
    sparkline(st.history),
    el("h3", { text: "Bilanz gegen Gegner" }),
    opponentTable(name, st),
    allPlayerNames().length > 1 ? el("div", { class: "cmp-switch" }, [
      el("span", { class: "note", text: "Vergleichen mit:" }),
      compareSelect(name, null, function (n) { openCompare(name, n); }, "Spieler wählen …"),
    ]) : null,
  ]));
  openDialog(dlg);
}

// ---------- Kacheln mit den Saisonwerten ----------
function tile(label, value, sub) {
  return el("div", { class: "tile" }, [
    el("span", { class: "tile-label", text: label }),
    el("b", { text: value }),
    sub ? el("span", { class: "tile-sub", text: sub }) : null,
  ]);
}

function statTiles(st) {
  const diff = st.lw - st.ll;
  const doubles = st.coHit + st.coMiss;
  return el("div", { class: "tiles" }, [
    tile("Punkte", String(st.points), st.days + (st.days === 1 ? " Spieltag" : " Spieltage")),
    tile("Beste Platzierung", st.best ? st.best + "." : "–", st.best ? st.bestCount + "×" : null),
    tile("Spiele", st.w + "–" + st.l, "Siegquote " + pct(st.w, st.w + st.l)),
    tile("Legs", st.legGames ? st.lw + ":" + st.ll : "–", st.legGames ? (diff > 0 ? "+" : "") + diff + " · " + pct(st.lw, st.lw + st.ll) : "noch keine Legs"),
    tile("Entscheidungslegs", st.dec ? st.decW + " von " + st.dec : "–", st.dec ? "gewonnen (" + pct(st.decW, st.dec) + ")" : "z. B. 3:2"),
    tile("Average", st.avgN ? fmtAvg(st.avgSum / st.avgN) : "–", st.avgN ? "Bester: " + fmtAvg(st.bestAvg) : "noch nicht erfasst"),
    tile("First 9", st.f9N ? fmtAvg(st.f9Sum / st.f9N) : "–", st.f9N ? "Ø der ersten 9 Darts" : "nur mit Live-Zähler"),
    tile("100+ / 140+", st.tN ? st.t100 + " / " + st.t140 : "–",
      st.tN ? "in " + st.tN + (st.tN === 1 ? " gezähltem Spiel" : " gezählten Spielen") : "nur mit Live-Zähler"),
    tile("Checkout-Quote", doubles ? pct(st.coHit, doubles) : "–",
      doubles ? st.coHit + " von " + doubles + " Doppeln" : "noch nicht erfasst"),
    tile("180er", String(st.n180), st.n180 ? "an " + st.days180 + (st.days180 === 1 ? " Spieltag" : " Spieltagen") : "noch keine"),
    tile("Höchstes Finish", st.hiCo ? String(st.hiCo) : "–", st.coTops ? st.coTops + "× Tagesbestwert" : (st.hiCo ? "Saison-Bestwert" : "noch nicht erfasst")),
    tile("Kürzestes Leg", st.bestLeg ? st.bestLeg + " Darts" : "–", st.legTops ? st.legTops + "× Tagesbestwert" : (st.bestLeg ? "Saison-Bestwert" : "noch nicht erfasst")),
  ]);
}

// ---------- Serie, Lieblings- und Angstgegner ----------
function factList(st) {
  const facts = [];
  if (st.streak >= 2) facts.push((st.streakWin ? "🔥 " : "") + st.streak + (st.streakWin ? " Siege" : " Niederlagen") + " in Folge");
  if (st.nil) facts.push(st.nil + (st.nil === 1 ? " Sieg" : " Siege") + " zu null");
  const oppText = function (o) { return o.name + " (" + o.w + "–" + o.l + (o.legs ? ", Legs " + o.lw + ":" + o.ll : "") + ")"; };
  if (st.fav) facts.push("Lieblingsgegner: " + oppText(st.fav));
  if (st.nem) facts.push("Angstgegner: " + oppText(st.nem));
  return facts.length ? el("ul", { class: "facts" }, facts.map(function (f) { return el("li", { text: f }); })) : null;
}

function opponentTable(name, st) {
  if (!st.opps.length) return el("p", { class: "note", text: "Noch keine Spiele." });
  const rows = st.opps.map(function (o) {
    return el("tr", null, [
      el("td", null, [nameBtn(o.name)]),
      el("td", { class: "num" + (o.w > o.l ? " good" : o.l > o.w ? " bad" : ""), text: o.w + "–" + o.l }),
      el("td", { class: "num dash", text: o.legs ? o.lw + ":" + o.ll : "" }),
      el("td", { class: "num" }, [el("button", { type: "button", class: "vs-link", text: "vs", title: name + " und " + o.name + " vergleichen",
        onclick: function () { openCompare(name, o.name); } })]),
    ]);
  });
  return el("table", { class: "mini opp" }, [
    el("thead", null, [el("tr", null, [el("th", { text: "Gegner" }), el("th", { class: "num", text: "Spiele" }), el("th", { class: "num", text: "Legs" }), el("th", { class: "num", text: "" })])]),
    el("tbody", null, rows),
  ]);
}

// Elo-Wert im Kopf der Spielerkarte, z. B. "Elo 1101 ▲37"
function eloBadge(name) {
  const e = state.elo[name];
  if (!e) return null;
  const d = Math.round(e.delta);
  const ranked = Object.keys(state.elo).sort(function (x, y) { return state.elo[y].rating - state.elo[x].rating; });
  return el("span", { class: "elo-badge", title: (ranked.indexOf(name) + 1) + ". der Elo-Wertung · Höchstwert " + Math.round(e.peak) + " · Veränderung seit dem letzten Spieltag" }, [
    document.createTextNode("Elo " + Math.round(e.rating)),
    d ? el("span", { class: d > 0 ? "up" : "down", text: (d > 0 ? " ▲" : " ▼") + Math.abs(d) }) : null,
  ]);
}

// ---------------------------------------------------------------------
//  Platzierungsverlauf als kleines Liniendiagramm
// ---------------------------------------------------------------------
export const CHART = { W: 320, H: 130, padL: 30, padR: 22, padT: 18, padB: 22, inset: 18 };

// x- und y-Position im Diagramm, Gitterlinien für Platz 1, 4 und 8
export function chartFrame(n, maxPlace) {
  const c = CHART;
  const x = function (i) { return n === 1 ? (c.padL + c.W - c.padR) / 2 : c.padL + c.inset + i * (c.W - c.padL - c.inset - c.padR) / (n - 1); };
  const y = function (pl) { return c.padT + (pl - 1) * (c.H - c.padT - c.padB) / (maxPlace - 1); };
  const grid = [];
  [1, 4, 8].forEach(function (pl) {
    grid.push(svg("line", { x1: c.padL, x2: c.W - c.padR, y1: y(pl), y2: y(pl), class: "grid" }));
    grid.push(svgText({ x: c.padL - 8, y: y(pl) + 4, class: "axis", "text-anchor": "end" }, pl + "."));
  });
  return { x: x, y: y, grid: grid };
}

export function svgText(attrs, text) {
  const t = svg("text", attrs);
  t.textContent = text;
  return t;
}

function sparkline(history) {
  const pts = history.filter(function (h) { return h.place !== null; });
  if (pts.length === 0) return el("p", { class: "note", text: "Noch keine abgeschlossene Platzierung." });
  const maxPlace = Math.max(8, Math.max.apply(null, pts.map(function (p) { return p.place; })));
  const f = chartFrame(history.length, maxPlace);
  const g = f.grid;
  let path = "";
  history.forEach(function (h, i) {
    if (h.place === null) return;
    path += (path ? " L" : "M") + f.x(i).toFixed(1) + " " + f.y(h.place).toFixed(1);
  });
  if (pts.length > 1) g.push(svg("path", { d: path, class: "line" }));
  history.forEach(function (h, i) {
    g.push(svgText({ x: f.x(i), y: CHART.H - 4, class: "axis", "text-anchor": "middle" }, "ST " + h.nr));
    if (h.place === null) return;
    g.push(svg("circle", { cx: f.x(i), cy: f.y(h.place), r: 4.5, class: "dot" + (h.place === 1 ? " gold" : "") }));
    g.push(svgText({ x: f.x(i), y: f.y(h.place) - 9, class: "val", "text-anchor": "middle" }, h.place + "."));
  });
  return svg("svg", { viewBox: "0 0 " + CHART.W + " " + CHART.H, class: "spark", role: "img",
    "aria-label": "Platzierungen: " + history.map(function (h) { return "Spieltag " + h.nr + " Platz " + (h.place || "offen"); }).join(", ") }, g);
}
