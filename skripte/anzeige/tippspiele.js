// =====================================================================
//  Abschnitt „Tippspiele“ (unter dem Saisonfinale)
//  Ab zwei Tippspielen oben die Wertung der Saison (gewonnene Tippspiele und
//  Tabellenpunkte), darunter eine Leiste wie bei den Spieltagen: es wird
//  immer ein Tippspiel mit seinen Ergebnissen gezeigt (anfangs das neueste).
// =====================================================================
import { el } from "../kern/dom.js";
import { plural } from "../kern/hilfen.js";
import { state } from "../kern/zustand.js";
import { tippList } from "../auswertung/tippspiel.js";
import { nameBtn } from "./spielerkarte.js";
import { openTippspiele } from "../bearbeiten/tippspiele.js";

// "15.11.2026" -> sortierbare Zahl 20261115 (ohne Datum: 0)
function dateKey(d) {
  const m = String(d || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}

// Wertung: Siege, Tabellenpunkte, Teilnahmen
function summary(list) {
  const by = {};
  list.forEach(function (t) {
    Object.keys(t.tipps).forEach(function (n) {
      const s = by[n] || (by[n] = { name: n, wins: 0, points: 0, games: 0 });
      s.games++;
      if (t.sieger.indexOf(n) >= 0) { s.wins++; s.points += t.punkte; }
    });
  });
  return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) {
    return b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name, "de");
  });
}

function summaryTable(rows) {
  let rank = 0, last = null;
  return el("div", { class: "card table-wrap" }, [el("table", null, [
    el("thead", null, [el("tr", null, [
      el("th", { text: "Pl." }),
      el("th", { text: "Spieler" }),
      el("th", { class: "num", text: "Siege", title: "Gewonnene Tippspiele" }),
      el("th", { class: "num opt", text: "Dabei", title: "Mitgetippt" }),
      el("th", { class: "num", text: "Punkte", title: "Punkte für die Gesamttabelle" }),
    ])]),
    el("tbody", null, rows.map(function (r, i) {
      const key = r.points + "|" + r.wins;
      if (key !== last) { rank = i + 1; last = key; }
      return el("tr", { class: r.wins && rank <= 3 ? "r" + rank : "" }, [
        el("td", { class: "rank", text: rank + "." }),
        el("td", null, [nameBtn(r.name)]),
        el("td", { class: "num", text: String(r.wins) }),
        el("td", { class: "num opt", text: String(r.games) }),
        el("td", { class: "num pts" + (r.points ? "" : " dash"), text: r.points ? "+" + r.points : "–" }),
      ]);
    })),
  ])]);
}

// Ein Tippspiel: Kopf mit Gewinner, darunter alle Tipp-Punkte
function tippCard(t) {
  const names = Object.keys(t.tipps).sort(function (a, b) { return t.tipps[b] - t.tipps[a] || a.localeCompare(b, "de"); });
  let rank = 0, last = null;
  const win = t.sieger.length
    ? "🔮 " + t.sieger.join(" & ") + " · +" + t.punkte + " " + (t.punkte === 1 ? "Punkt" : "Punkte")
    : "Noch kein Gewinner";
  return el("div", { class: "card tipp-result" }, [
    el("div", { class: "tipp-head" }, [
      el("div", null, [
        el("h3", { text: t.name }),
        el("p", { class: "sub dash", text: [t.datum, plural(names.length, "Teilnehmer", "Teilnehmer")].filter(Boolean).join(" · ") }),
      ]),
      el("span", { class: "tipp-winner" + (t.sieger.length ? "" : " none"), text: win }),
    ]),
    names.length ? el("table", { class: "tipp-scores" }, [el("tbody", null, names.map(function (n, i) {
      if (t.tipps[n] !== last) { rank = i + 1; last = t.tipps[n]; }
      const won = t.sieger.indexOf(n) >= 0;
      return el("tr", { class: won ? "win" : "" }, [
        el("td", { class: "rank", text: rank + "." }),
        el("td", null, [nameBtn(n)]),
        el("td", { class: "num", text: t.tipps[n] + " P." }),
      ]);
    }))]) : el("p", { class: "empty", text: "Noch keine Tipps eingetragen." }),
  ]);
}

let selected = null;   // ausgewähltes Tippspiel (Name + Datum), sonst das neueste

function keyOf(t) { return t.name + "|" + t.datum; }

// In der Leiste ohne vorangestelltes „Tippspiel“: „Tippspiel WM“ -> „WM“
function shortName(name) { return name.replace(/^tippspiel\s*[:\-–]?\s*/i, "") || name; }

export function renderTippspiele() {
  const box = document.getElementById("tipp-view");
  if (!box) return;
  box.innerHTML = "";
  // Wie bei den Spieltagen: ältestes links, neuestes rechts
  const list = tippList(state.liga).map(function (t, i) { return Object.assign(t, { idx: i }); })
    .sort(function (a, b) { return dateKey(a.datum) - dateKey(b.datum) || b.idx - a.idx; });

  if (state.editing) {
    box.appendChild(el("div", { class: "row tipp-edit" }, [
      el("button", { type: "button", class: "btn primary", text: "🔮 Tippspiele bearbeiten", onclick: openTippspiele }),
    ]));
  }
  if (!list.length) {
    box.appendChild(el("div", { class: "card" }, [el("p", { class: "empty", text: "In dieser Saison gab es noch kein Tippspiel." })]));
    return;
  }
  // Wertung erst ab zwei Tippspielen (sonst steht dasselbe in der Karte)
  if (list.length > 1) {
    box.appendChild(el("h3", { class: "tipp-sub", text: "Wertung" }));
    box.appendChild(summaryTable(summary(list)));
    box.appendChild(el("h3", { class: "tipp-sub", text: plural(list.length, "Tippspiel", "Tippspiele") }));
  }

  // Leiste: immer nur ein Tippspiel zeigen
  const cur = list.filter(function (t) { return keyOf(t) === selected; })[0] || list[list.length - 1];
  const names = list.map(function (t) { return t.name; });
  const tabs = el("div", { class: "tabs", role: "group", "aria-label": "Tippspiel wählen" }, list.map(function (t) {
    const twice = names.indexOf(t.name) !== names.lastIndexOf(t.name);   // gleicher Name: Datum dazu
    return el("button", {
      type: "button", "aria-pressed": t === cur ? "true" : "false",
      text: shortName(t.name) + (twice && t.datum ? " · " + t.datum : ""),
      onclick: function () { selected = keyOf(t); renderTippspiele(); },
    });
  }));
  if (list.length > 1) box.appendChild(tabs);
  box.appendChild(tippCard(cur));
}
