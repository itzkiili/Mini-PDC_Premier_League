// =====================================================================
//  Gesamttabelle mit Trendpfeilen
// =====================================================================
import { el } from "../kern/dom.js";
import { fmtAvg, pct } from "../kern/hilfen.js";
import { state } from "../kern/zustand.js";
import { computeStandings } from "../auswertung/tabelle.js";
import { nameBtn } from "./spielerkarte.js";
import { tableStechenEl } from "../bearbeiten/eingabe.js";

// Indizes der Spieltage, an denen schon jemand platziert ist
export function playedDays(resolved) {
  return resolved.map(function (d, i) { return d.places.some(function (pl) { return pl.name; }) ? i : -1; })
    .filter(function (i) { return i >= 0; });
}

// Tabellenplätze vor dem letzten gespielten Spieltag (für die Trendpfeile), sonst null
export function previousRanks(resolved, played) {
  if (played.length < 2) return null;
  const prevRank = {};
  computeStandings(resolved.slice(0, played[played.length - 1])).rows
    .forEach(function (r) { prevRank[r.name] = r.rank; });
  return prevRank;
}

// Trendpfeil: Veränderung des Tabellenplatzes seit dem letzten Spieltag
function trendCell(prevRank, r) {
  if (!prevRank) return el("td", { class: "trend" });
  const before = prevRank[r.name];
  if (before === undefined) return el("td", { class: "trend new", text: "neu", title: "Neu in der Tabelle" });
  const diff = before - r.rank;
  if (diff > 0) return el("td", { class: "trend up", text: "▲" + diff, title: "Seit dem letzten Spieltag " + diff + (diff === 1 ? " Platz" : " Plätze") + " verbessert (vorher " + before + ".)" });
  if (diff < 0) return el("td", { class: "trend down", text: "▼" + (-diff), title: "Seit dem letzten Spieltag " + (-diff) + (diff === -1 ? " Platz" : " Plätze") + " verloren (vorher " + before + ".)" });
  return el("td", { class: "trend same", text: "–", title: "Platz unverändert" });
}

function signed(n) { return n > 0 ? "+" + n : String(n); }

// Zahl oder „–“, wenn nichts erfasst ist
function numCell(cls, has, text) {
  return el("td", { class: cls + (has ? "" : " dash"), text: has ? text : "–" });
}

export function renderStandings(standings, prevRank) {
  const rows = standings.rows;
  const box = document.getElementById("standings");
  box.innerHTML = "";
  if (!rows.length) {
    box.appendChild(el("div", { class: "empty", text: "Noch keine Ergebnisse eingetragen." }));
    return;
  }
  const thead = el("thead", null, [el("tr", null, [
    el("th", { text: "Pl." }),
    el("th", { class: "trend", text: "", title: "Veränderung seit dem letzten Spieltag" }),
    el("th", { text: "Spieler" }),
    el("th", { class: "num opt", text: "Spieltage" }),
    el("th", { class: "num", text: "Siege", title: "Gewonnene Spieltage" }),
    el("th", { class: "num opt", text: "2. Pl.", title: "Zweite Plätze" }),
    el("th", { class: "num opt", text: "Legs" }),
    el("th", { class: "num", text: "Diff." }),
    el("th", { class: "num opt", text: "Ø", title: "3-Dart-Average (Mittelwert der Spiele)" }),
    el("th", { class: "num opt", text: "CO %", title: "Checkout-Quote" }),
    el("th", { class: "num opt", text: "Bonus", title: "Bonuspunkte (in den Punkten enthalten)" }),
    el("th", { class: "num", text: "Punkte" }),
  ])]);
  const tbody = el("tbody");
  rows.forEach(function (r) {
    const rank = r.rank;
    const doubles = r.coHit + r.coMiss;
    tbody.appendChild(el("tr", { class: r.points > 0 && rank <= 3 ? "r" + rank + (rank === 1 ? " top1" : "") : "" }, [
      el("td", { class: "rank", text: rank + "." }),
      trendCell(prevRank, r),
      el("td", null, [nameBtn(r.name)]),
      el("td", { class: "num opt", text: String(r.days) }),
      el("td", { class: "num", text: String(r.wins) }),
      el("td", { class: "num opt", text: String(r.seconds) }),
      numCell("num opt", r.legs, r.lw + ":" + r.ll),
      numCell("num diff", r.legs, signed(r.lw - r.ll)),
      numCell("num opt", r.avgN, r.avgN ? fmtAvg(r.avgSum / r.avgN) : ""),
      numCell("num opt", doubles, pct(r.coHit, doubles)),
      numCell("num opt", r.bonus, "+" + r.bonus),
      el("td", { class: "num pts", text: String(r.points) }),
    ]));
  });
  box.appendChild(el("table", null, [thead, tbody]));
  if (state.editing && standings.openTies.length) box.appendChild(tableStechenEl(standings.openTies));
}
