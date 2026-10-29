// =====================================================================
//  Liga-Seite – „Nächstes Spiel“ oben auf der Seite
//  Erscheint, solange ein Spieltag läuft: die nächste offene Partie mit
//  Bild, Spitzname und Siegchance. Ein Klick öffnet den Direktvergleich.
//  Reihenfolge der Spiele: PLAY_ORDER (skripte/4-spielerkarte.js).
// =====================================================================
"use strict";

// Nächste offene Partie: zuerst im festgelegten aktuellen Spieltag, sonst im neuesten laufenden
function findNextMatch() {
  const order = [];
  if (LIGA_DATA.aktuell != null && typeof dayIdxByNr === "function") {
    const i = dayIdxByNr(LIGA_DATA.aktuell);
    if (i >= 0) order.push(i);
  }
  for (let i = lastResolved.length - 1; i >= 0; i--) if (order.indexOf(i) < 0) order.push(i);
  for (let k = 0; k < order.length; k++) {
    const d = lastResolved[order[k]];
    if (!d || d.complete || !d.count) continue;
    for (let j = 0; j < PLAY_ORDER.length; j++) {
      const mt = d.matches[PLAY_ORDER[j]];
      if (mt && mt.state === "offen" && mt.a.name && mt.b.name) return { day: d, match: mt };
    }
  }
  return null;
}

function nextMatchSide(name, cls) {
  const p = typeof profileOf === "function" ? profileOf(name) : {};
  return el("div", { class: "nm-side " + cls }, [
    typeof profileAvatar === "function" ? profileAvatar(name) : null,
    el("b", { class: "nm-name", text: name }),
    p.spitzname ? el("span", { class: "nm-nick", text: "„" + p.spitzname + "“" }) : null,
  ]);
}

function renderNextMatch() {
  let box = document.getElementById("next-match");
  if (!box) {
    box = el("section", { id: "next-match", "aria-label": "Nächstes Spiel" });
    const anchor = document.getElementById("tabelle");
    if (anchor) anchor.parentNode.insertBefore(box, anchor); else return;
  }
  box.innerHTML = "";
  const archive = typeof viewingArchive === "function" && viewingArchive();
  const next = (!editing && !archive) ? findNextMatch() : null;
  box.hidden = !next;
  if (!next) return;

  const a = next.match.a.name, b = next.match.b.name;
  const ea = lastElo[a] || { rating: ELO_START }, eb = lastElo[b] || { rating: ELO_START };
  const ch = duelChance(ea, eb, typeof headToHeadAll === "function" ? headToHeadAll(a, b) : []);
  const pa = Math.round(ch.p * 100);
  const live = next.match.score ? next.match.score.a + " : " + next.match.score.b : null;

  const card = el("button", { type: "button", class: "card nm-card", title: "Direktvergleich öffnen",
    onclick: function () { openCompare(a, b); } }, [
    el("div", { class: "nm-head" }, [
      el("span", { class: "nm-label", text: live ? "Läuft gerade" : "Nächstes Spiel" }),
      el("span", { class: "nm-where", text: "Spieltag " + next.day.nr + " · " + LABELS[next.match.id] }),
    ]),
    el("div", { class: "nm-row" }, [
      nextMatchSide(a, "a"),
      el("span", { class: "nm-vs", text: live || "vs" }),
      nextMatchSide(b, "b"),
    ]),
    el("div", { class: "chance-bar nm-chance", "aria-label": "Siegchance " + a + " " + pa + " %, " + b + " " + (100 - pa) + " %" }, [
      el("span", { class: "chance a", style: "width:" + pa + "%", text: pa + " %" }),
      el("span", { class: "chance b", style: "width:" + (100 - pa) + "%", text: (100 - pa) + " %" })
    ]),
  ]);
  box.appendChild(card);
}
render();