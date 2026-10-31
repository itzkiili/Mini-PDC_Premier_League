// =====================================================================
//  Ein Spieltag: Kopf, Platzierung, Turnierbaum oder Dreiergruppen, Bonus
//  Im Bearbeiten-Modus kommen die Eingabefelder aus bearbeiten/eingabe.js dazu.
// =====================================================================
import { PLACE_OF, LABELS } from "../kern/konstanten.js";
import { el } from "../kern/dom.js";
import { toNum, fmtAvg } from "../kern/hilfen.js";
import { state, bonusCfg } from "../kern/zustand.js";
import { shareDayLink } from "./navigation.js";
import { nameBtn } from "./spielerkarte.js";
import { openCompare } from "./vergleich.js";
import { achievementsOfDay } from "./erfolge.js";
import { cleanModus, dayModus, vorlageOf, modusText } from "../auswertung/modus.js";
import {
  dateInput, pinDayButton, modusEditor, deleteDayButton, playerEditor, bonusEditor,
  scoreInput, pickWinner, statsPanel, groupStechenEl,
} from "../bearbeiten/eingabe.js";

export function dayView(day, d) {
  const editing = state.editing;
  const nr = d.nr != null ? d.nr : state.currentIdx + 1;
  const wrap = el("div");

  // ---------- Kopf ----------
  let shareBtn = null;
  if (!editing) {
    shareBtn = el("button", { class: "linkbtn day-share", type: "button", text: "🔗 Link", title: "Link zu diesem Spieltag teilen",
      onclick: function () { shareDayLink(nr, shareBtn); } });
  }
  wrap.appendChild(el("div", { class: "day-head" }, [
    el("h3", { text: "Spieltag " + nr + (!editing && d.datum ? " · " + d.datum : "") }),
    editing ? dateInput(day) : null,
    el("span", { class: "badge" + (d.complete ? " done" : ""), text: d.complete ? "abgeschlossen" : "läuft" }),
    d.count ? el("span", { class: "badge", text: d.count + " Spieler · " + (d.mode === "gruppe" ? "Dreiergruppen" : "Turnierbaum") }) : null,
    modusBadge(day),
    editing ? pinDayButton(day) : shareBtn,
    editing ? deleteDayButton(day) : null,
  ]));
  if (!editing) {
    const newAch = achievementsOfDay(d);
    if (newAch) wrap.appendChild(newAch);
  }
  if (editing) wrap.appendChild(playerEditor(day));
  if (editing) wrap.appendChild(modusEditor(day));

  // ---------- Platzierung und Turnierbaum ----------
  const treeBox = el("div", null, [el("h3", { text: "Turnierbaum" }), el("div", { class: "card" }, treeOf(day, d))]);
  if (editing && d.count) treeBox.appendChild(el("p", { class: "hint", text: "Trag in die Felder die Legs ein, der Sieger ergibt sich dann automatisch. Ohne Legs kannst du auch einfach auf den Namen des Siegers klicken; ein zweiter Klick entfernt das Ergebnis wieder." }));
  wrap.appendChild(el("div", { class: "day-grid" }, [placesBox(d), treeBox]));

  // ---------- Bonus ----------
  if (editing && d.count) wrap.appendChild(bonusEditor(day, d));
  else if (d.bonus.any) wrap.appendChild(bonusView(d));
  return wrap;
}

// Abweichender Spielmodus, z. B. „170er-Legs · 170 Double Out · Best of 5“
function modusBadge(day) {
  if (!cleanModus(day.modus)) return null;
  const vorlage = vorlageOf(day.modus);
  const m = dayModus(day, state.liga);
  return el("span", { class: "badge modus", text: (vorlage ? vorlage.name : "Eigener Modus") + " · " + modusText(m),
    title: "Spielmodus an diesem Spieltag. Finale: " + modusText(m, true) });
}

// Platzierung erst zeigen, wenn alle Spiele gespielt sind (im Bearbeiten-Modus immer)
function placesBox(d) {
  const placeRows = d.places.filter(function (p) { return p.name !== null; }).map(function (p) {
    const bonus = p.name ? d.bonus.pointsOf(p.name) : 0;
    return el("tr", null, [
      el("td", { class: "rank", text: p.place + "." }),
      p.name === undefined ? el("td", { class: "dash", text: "–" }) : el("td", null, [nameBtn(p.name)]),
      el("td", { class: "num" + (p.name ? " pts" : " dash") }, p.name ? [
        document.createTextNode((p.points + bonus) + " P."),
        bonus ? el("span", { class: "bonus-tag", text: "inkl. +" + bonus }) : null,
      ] : []),
    ]);
  });
  const hidePlaces = !state.editing && !d.complete && placeRows.length;
  return el("div", null, [
    el("h3", { text: "Platzierung" }),
    hidePlaces
      ? el("div", { class: "card places" }, [el("p", { class: "note places-wait", text: "Die Platzierung erscheint, sobald alle Spiele gespielt sind." })])
      : el("div", { class: "card places" }, [el("table", null, [el("tbody", null,
          placeRows.length ? placeRows : [el("tr", null, [el("td", { class: "dash", text: "Noch keine Spieler eingetragen." })])])])]),
  ]);
}

function treeOf(day, d) {
  const m = d.matches;
  if (d.count === 0) {
    return [el("div", { class: "bracket" }, [el("p", { class: "note", text: state.editing ? "Trag oben die Spieler ein, dann erscheint hier der Turnierbaum." : "Noch keine Spieler eingetragen." })])];
  }
  if (d.mode === "gruppe") {
    return [el("div", { class: "bracket" }, [
      el("h3", { text: "Viertelfinale" }),
      el("div", { class: "rounds" }, [m.VF1, m.VF2, m.VF3].map(function (mt) {
        return el("div", { class: "round" }, [matchEl(day, mt)]);
      })),
    ])].concat(d.groups.map(function (g) { return groupEl(day, g); }));
  }
  return [
    el("div", { class: "bracket" }, [
      el("h3", { text: "Hauptrunde · Plätze 1–4" }),
      swipeHint(),
      el("div", { class: "rounds" }, [
        roundEl(day, "Viertelfinale", [m.VF1, m.VF2, m.VF3, m.VF4]),
        roundEl(day, "Halbfinale", [m.HF1, m.HF2]),
        roundEl(day, "Platzierung", [m.Finale, m.P3], "Finale"),
      ]),
    ]),
    el("div", { class: "bracket" }, [
      el("h3", { text: "Platzierungsrunde · Plätze 5–8" }),
      swipeHint(),
      el("div", { class: "rounds two" }, [
        roundEl(day, "Platzierungsrunde", [m.PR1, m.PR2]),
        roundEl(day, "Platzierung", [m.P5, m.P7]),
      ]),
    ]),
  ];
}

// ---------- Bonuspunkte (Anzeige) ----------
function bonusLines(d) {
  const b = d.bonus, cfg = bonusCfg();
  const lines = [];
  if (b.bestCo !== null) lines.push(["Höchstes Checkout", b.coNames.join(", ") + " (" + b.bestCo + ")", "+" + cfg.checkout]);
  if (b.bestLeg !== null) lines.push(["Kürzestes Leg", b.legNames.join(", ") + " (" + b.bestLeg + " Darts)", "+" + cfg.leg]);
  Object.keys(b.per).filter(function (n) { return b.per[n].n180; }).forEach(function (n) {
    lines.push(["180er", n + " (" + b.per[n].n180 + "×)", "+" + b.per[n].n180 * cfg.je180]);
  });
  return lines;
}

function bonusView(d) {
  return el("div", { class: "bonus-box" }, [
    el("h3", { text: "Bonuspunkte" }),
    el("div", { class: "card" }, [el("table", null, [el("tbody", null, bonusLines(d).map(function (l) {
      return el("tr", null, [el("td", { class: "dash", text: l[0] }), el("td", { text: l[1] }), el("td", { class: "num pts", text: l[2] })]);
    }))])]),
  ]);
}

// Hinweis am Handy, dass man seitlich wischen kann (nur bei schmalem Bildschirm sichtbar)
export function swipeHint() {
  return el("p", { class: "swipe-hint", text: "← Seitlich wischen für die nächste Runde →" });
}

// ---------- Spiele ----------
function isPickable(match) {
  return state.editing && (match.state === "offen" || match.state === "gespielt");
}

// Klick und Enter/Leertaste lösen dieselbe Aktion aus
function clickable(action) {
  return {
    role: "button",
    tabindex: "0",
    onclick: action,
    onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); } },
  };
}

// Ein Spieler in einem Spiel (Name, Legs, Average)
function slotEl(day, match, side, tagText) {
  const s = side === "a" ? match.a : match.b;
  if (s.pending) return el("div", { class: "slot tbd" }, [el("span", { text: s.from })]);
  if (s.name === null) return el("div", { class: "slot bye" }, [el("span", { text: "Freilos" })]);
  let cls = "slot";
  if (match.winner) cls += match.winner === s.name ? " win" : " lose";
  const pickable = isPickable(match);
  if (pickable) cls += " pick";
  const right = el("span", { class: "right" });
  if (tagText) right.appendChild(el("span", { class: "tag", text: tagText }));
  if (pickable) right.appendChild(scoreInput(day, match, side));
  else {
    const ps = match.stats && match.stats[s.name];
    if (ps && toNum(ps.avg) !== null) right.appendChild(el("span", { class: "avg", text: "Ø " + fmtAvg(toNum(ps.avg)) }));
    if (match.score) right.appendChild(el("span", { class: "score", text: String(side === "a" ? match.score.a : match.score.b) }));
  }
  const attrs = { class: cls };
  if (pickable) {
    Object.assign(attrs, clickable(function () { pickWinner(day, match.id, s.name); }));
    attrs.title = "Als Sieger eintragen";
  }
  return el("div", attrs, [el("span", { class: "nm", text: s.name }), right]);
}

function matchEl(day, match, isFinal) {
  const pl = PLACE_OF[match.id];
  function tagFor(side) {
    if (!pl || !match.winner) return null;
    const s = side === "a" ? match.a : match.b;
    if (!s.name) return null;
    return "Platz " + (s.name === match.winner ? pl[0] : pl[1]);
  }
  let stateText = "";
  if (match.state === "freilos") stateText = "kampflos";
  else if (match.state === "offen") stateText = "offen";
  // Noch nicht gespielt und beide Spieler bekannt: Klick öffnet den Vergleich
  const preview = !state.editing && match.state === "offen" && match.a.name && match.b.name;
  if (preview) stateText = "Vorschau ›";
  const attrs = { class: "match" + (isFinal ? " final" : "") + (preview ? " preview" : "") };
  if (preview) {
    Object.assign(attrs, clickable(function () { openCompare(match.a.name, match.b.name); }));
    attrs.title = match.a.name + " und " + match.b.name + " vergleichen";
  }
  return el("div", attrs, [
    el("div", { class: "match-head" }, [el("span", { text: LABELS[match.id] }), el("span", { text: stateText })]),
    slotEl(day, match, "a", tagFor("a")),
    slotEl(day, match, "b", tagFor("b")),
  ].concat(isPickable(match) ? statsPanel(day, match) : []));
}

function roundEl(day, title, matches, finalId) {
  return el("div", { class: "round" }, [
    el("div", { class: "round-title", text: title }),
    el("div", { class: "round-body" }, matches.map(function (mt) {
      return (!mt || mt.state === "leer") ? null : matchEl(day, mt, mt.id === finalId);
    })),
  ]);
}

// ---------- Dreiergruppe (5–6 Spieler) ----------
function groupEl(day, g) {
  const size = g.members.length || 3;
  const range = "Plätze " + (g.offset + 1) + "–" + (g.offset + size);
  let rows;
  if (!g.members.length) {
    rows = [el("tr", null, [el("td", { class: "dash", text: "Wartet auf die Viertelfinals" })])];
  } else {
    const list = g.order || g.members.slice().sort(function (a, b) { return g.wins[b] - g.wins[a]; });
    rows = list.map(function (n, i) {
      return el("tr", null, [
        el("td", { class: "rank", text: g.order ? (g.offset + i + 1) + "." : "–" }),
        el("td", { text: n }),
        el("td", { class: "num", text: g.wins[n] + (g.wins[n] === 1 ? " Sieg" : " Siege") }),
        el("td", { class: "num dash", text: g.legs && g.legs[n] && g.legs[n].any ? g.legs[n].w + ":" + g.legs[n].l : "" }),
      ]);
    });
  }
  let note = null;
  if (g.tie && !g.order) note = el("p", { class: "note", text: "Gleichstand: Jeder hat ein Spiel gewonnen. Die Reihenfolge wird per Stechen ermittelt." });
  else if (g.tie) note = el("p", { class: "note", text: "Reihenfolge nach Stechen." });

  const games = g.matches.filter(function (mt) {
    return mt.state !== "leer" && mt.state !== "freilos";
  }).map(function (mt) { return matchEl(day, mt); });
  return el("div", { class: "bracket" }, [
    el("h3", { text: g.title + " · " + range }),
    el("div", { class: "group-grid" }, [
      el("table", { class: "mini" }, [el("tbody", null, rows)]),
      el("div", { class: "games" }, games),
    ]),
    note,
    state.editing && g.tie ? groupStechenEl(day, g) : null,
  ]);
}
