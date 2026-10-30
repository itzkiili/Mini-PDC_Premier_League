// =====================================================================
//  Weltrangliste: ewige Elo-Rangliste über alle Saisons
// =====================================================================
import { ELO_START } from "../kern/konstanten.js";
import { el, getDialog, openDialog, closeButton } from "../kern/dom.js";
import { state } from "../kern/zustand.js";
import { openPlayer } from "./spielerkarte.js";

// Abschnitt mit Knopf direkt unter dem Saisonfinale anlegen
export function renderWorldSection() {
  if (document.getElementById("weltrangliste")) return;
  const sec = el("section", { id: "weltrangliste" }, [
    el("h2", { text: "Weltrangliste" }),
    el("p", { class: "note", text: "Die ewige Elo-Rangliste über alle Saisons. Jeder beginnt einmal mit " + ELO_START + ", danach wird die Wertung von Saison zu Saison weitergeführt." }),
    el("button", { type: "button", class: "btn primary", text: "Weltrangliste öffnen", onclick: openWorldRanking }),
  ]);
  const after = document.getElementById("saisonfinale") || document.getElementById("regeln");
  after.parentNode.insertBefore(sec, after.nextSibling);
  // Aufruf mit …#weltrangliste: nach dem Anlegen dorthin springen
  if (location.hash === "#weltrangliste") sec.scrollIntoView();
}

function openWorldRanking() {
  const dlg = getDialog("world-dialog");
  dlg.innerHTML = "";
  const elo = state.elo;
  const names = Object.keys(elo);
  names.sort(function (a, b) { return elo[b].rating - elo[a].rating; });
  const inTable = {};
  state.rows.forEach(function (r) { inTable[r.name] = true; });
  const stand = state.archiveView ? "Stand: Ende der Saison „" + state.archiveView.name + "“" : "Stand: " + (state.liga.name || "aktuelle Saison");

  const rows = names.map(function (n, i) {
    const e = elo[n];
    const d = Math.round(e.delta || 0);
    return el("tr", { class: i < 3 ? "r" + (i + 1) : "" }, [
      el("td", { class: "rank", text: (i + 1) + "." }),
      el("td", null, [inTable[n]
        ? el("button", { type: "button", class: "player-link", text: n, onclick: function () { dlg.close(); openPlayer(n); } })
        : el("span", { text: n })]),
      el("td", { class: "num pts", text: String(Math.round(e.rating)) }),
      el("td", { class: "num trend-cell " + (d > 0 ? "up" : d < 0 ? "down" : "same"), text: d > 0 ? "▲" + d : d < 0 ? "▼" + (-d) : "–" }),
      el("td", { class: "num opt", text: String(Math.round(e.peak)) }),
      el("td", { class: "num opt", text: String(e.games) }),
      el("td", { class: "num opt", text: String(e.seasons || 0) }),
    ]);
  });

  dlg.appendChild(el("div", { class: "pc" }, [
    el("div", { class: "pc-head" }, [
      el("div", null, [el("h2", { text: "Weltrangliste" }), el("p", { class: "sub", text: stand })]),
      closeButton(dlg),
    ]),
    names.length ? el("div", { class: "table-wrap" }, [el("table", { class: "world" }, [
      el("thead", null, [el("tr", null, [
        el("th", { text: "Pl." }), el("th", { text: "Spieler" }), el("th", { class: "num", text: "Elo" }),
        el("th", { class: "num", text: "±", title: "Veränderung am letzten Spieltag" }),
        el("th", { class: "num opt", text: "Höchstwert" }), el("th", { class: "num opt", text: "Spiele" }), el("th", { class: "num opt", text: "Saisons" }),
      ])]),
      el("tbody", null, rows),
    ])]) : el("p", { class: "note", text: "Noch keine Spiele gewertet." }),
    el("p", { class: "note small-note", text: "Nach jedem Spiel gibt der Verlierer Elo-Punkte an den Sieger ab – umso mehr, je überraschender der Sieg. Wer länger nicht spielt, behält seinen Wert." }),
  ]));
  openDialog(dlg);
}
