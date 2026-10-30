// =====================================================================
//  „Nächstes Spiel“ oben auf der Seite
//  Erscheint, solange ein Spieltag läuft: die nächste offene Partie mit
//  Bild, Spitzname und Siegchance. Ein Klick öffnet den Direktvergleich.
// =====================================================================
import { ELO_START, LABELS, PLAY_ORDER } from "../kern/konstanten.js";
import { el } from "../kern/dom.js";
import { state, viewingArchive } from "../kern/zustand.js";
import { duelChance } from "../auswertung/elo.js";
import { headToHeadAll } from "../auswertung/statistik.js";
import { dayIdxByNr } from "./navigation.js";
import { openCompare, chanceBar } from "./vergleich.js";
import { profileAvatar, profileOf } from "./profil.js";

// Nächste offene Partie: zuerst im festgelegten aktuellen Spieltag, sonst im neuesten laufenden
function findNextMatch() {
  const order = [];
  if (state.liga.aktuell != null) {
    const i = dayIdxByNr(state.liga.aktuell);
    if (i >= 0) order.push(i);
  }
  for (let i = state.resolved.length - 1; i >= 0; i--) if (order.indexOf(i) < 0) order.push(i);
  for (let k = 0; k < order.length; k++) {
    const d = state.resolved[order[k]];
    if (!d || d.complete || !d.count) continue;
    for (let j = 0; j < PLAY_ORDER.length; j++) {
      const mt = d.matches[PLAY_ORDER[j]];
      if (mt && mt.state === "offen" && mt.a.name && mt.b.name) return { day: d, match: mt };
    }
  }
  return null;
}

function side(name, cls) {
  const p = profileOf(name);
  return el("div", { class: "nm-side " + cls }, [
    profileAvatar(name),
    el("b", { class: "nm-name", text: name }),
    p.spitzname ? el("span", { class: "nm-nick", text: "„" + p.spitzname + "“" }) : null,
  ]);
}

export function renderNextMatch() {
  let box = document.getElementById("next-match");
  if (!box) {
    box = el("section", { id: "next-match", "aria-label": "Nächstes Spiel" });
    const anchor = document.getElementById("tabelle");
    if (anchor) anchor.parentNode.insertBefore(box, anchor); else return;
  }
  box.innerHTML = "";
  const next = (!state.editing && !viewingArchive()) ? findNextMatch() : null;
  box.hidden = !next;
  if (!next) return;

  const a = next.match.a.name, b = next.match.b.name;
  const ea = state.elo[a] || { rating: ELO_START }, eb = state.elo[b] || { rating: ELO_START };
  const pa = Math.round(duelChance(ea, eb, headToHeadAll(a, b)).p * 100);
  const live = next.match.score ? next.match.score.a + " : " + next.match.score.b : null;

  box.appendChild(el("button", { type: "button", class: "card nm-card", title: "Direktvergleich öffnen",
    onclick: function () { openCompare(a, b); } }, [
    el("div", { class: "nm-head" }, [
      el("span", { class: "nm-label", text: live ? "Läuft gerade" : "Nächstes Spiel" }),
      el("span", { class: "nm-where", text: "Spieltag " + next.day.nr + " · " + LABELS[next.match.id] }),
    ]),
    el("div", { class: "nm-row" }, [
      side(a, "a"),
      el("span", { class: "nm-vs", text: live || "vs" }),
      side(b, "b"),
    ]),
    chanceBar(pa, { class: "chance-bar nm-chance", "aria-label": "Siegchance " + a + " " + pa + " %, " + b + " " + (100 - pa) + " %" }),
  ]));
}
