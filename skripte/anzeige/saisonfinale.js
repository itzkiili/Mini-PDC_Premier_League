// =====================================================================
//  Saisonfinale (provisorisch nach aktuellem Tabellenstand)
//  Viertelfinale 1–8, 4–5, 2–7, 3–6 → Halbfinale → Finale
// =====================================================================
import { el } from "../kern/dom.js";
import { viewingArchive } from "../kern/zustand.js";
import { nameBtn } from "./spielerkarte.js";
import { openCompare } from "./vergleich.js";
import { swipeHint } from "./spieltag.js";

export function renderSeasonFinal(rows, playedDays) {
  const box = document.getElementById("final-bracket");
  const note = document.getElementById("final-note");
  if (!box) return;
  box.innerHTML = "";
  note.textContent = viewingArchive()
    ? "Paarungen nach der Abschlusstabelle dieser Saison."
    : playedDays
    ? "Provisorisch nach dem aktuellen Tabellenstand (" + playedDays + (playedDays === 1 ? " Spieltag" : " Spieltage") + "). Die endgültigen Paarungen stehen nach dem letzten Spieltag fest."
    : "Die Paarungen ergeben sich aus der Tabelle am Saisonende.";

  // Platz in der Tabelle (nur wer schon Punkte hat) oder Platzhalter
  const at = function (place) {
    const r = rows[place - 1];
    return { label: "Platz " + place, name: r && r.points > 0 ? r.name : null };
  };
  const ref = function (text) { return { label: null, name: null, ref: text }; };

  box.appendChild(el("div", { class: "bracket" }, [
    swipeHint(),
    el("div", { class: "rounds" }, [
      round("Viertelfinale", [
        match("VF1", at(1), at(8)),
        match("VF2", at(4), at(5)),
        match("VF3", at(2), at(7)),
        match("VF4", at(3), at(6)),
      ]),
      round("Halbfinale", [
        match("HF1", ref("Sieger VF1 (1-8)"), ref("Sieger VF2 (4–5)")),
        match("HF2", ref("Sieger VF3 (2–7)"), ref("Sieger VF4 (3–6)")),
      ]),
      round("Finale", [
        match("Finale", ref("Sieger HF1"), ref("Sieger HF2"), true),
      ]),
    ]),
  ]));
}

function slot(s) {
  if (s.ref) return el("div", { class: "slot tbd" }, [el("span", { class: "nm", text: s.ref })]);
  if (!s.name) return el("div", { class: "slot tbd" }, [el("span", { class: "nm", text: s.label })]);
  return el("div", { class: "slot" }, [nameBtn(s.name), el("span", { class: "right" }, [el("span", { class: "tag", text: s.label })])]);
}

function match(title, a, b, isFinal) {
  const preview = a.name && b.name;
  return el("div", { class: "match" + (isFinal ? " final" : "") }, [
    el("div", { class: "match-head" }, [
      el("span", { text: title }),
      preview ? el("button", { type: "button", class: "head-link", text: "Vorschau ›", title: a.name + " und " + b.name + " vergleichen",
        onclick: function () { openCompare(a.name, b.name); } }) : null,
    ]),
    slot(a), slot(b),
  ]);
}

function round(title, items) {
  return el("div", { class: "round" }, [el("div", { class: "round-title", text: title }), el("div", { class: "round-body" }, items)]);
}
