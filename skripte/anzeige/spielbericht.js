// =====================================================================
//  Spielbericht: Statistik eines gespielten Spiels im Nachhinein
//  Geöffnet aus dem Turnierbaum (Klick auf ein gespieltes Spiel) und aus
//  den direkten Duellen im Vergleich. Zeigt nur, was gespeichert ist:
//  von Hand eingetragene Spiele haben oft nur Legs, Average und Doppel,
//  Spiele aus dem Live-Zähler zusätzlich First 9, 100+/140+, High Finish,
//  kürzestes Leg, 180er und den Legverlauf.
// =====================================================================
import { LABELS } from "../kern/konstanten.js";
import { el, getDialog, openDialog, closeButton } from "../kern/dom.js";
import { toNum } from "../kern/hilfen.js";
import { modusText } from "../auswertung/modus.js";
import { profileAvatar } from "./profil.js";
import { openCompare } from "./vergleich.js";

function dec(v) { return v.toFixed(2).replace(".", ","); }

// Zeilen: [Bezeichnung, Wert aus den Daten, Format, mehr ist besser?]
// p = { name, legs, ps (gespeicherte Statistik) }
const ROWS = [
  ["Average", function (p) { return toNum(p.ps.avg); }, dec, true],
  ["First 9", function (p) { return toNum(p.ps.f9); }, dec, true],
  ["Checkout-Quote", function (p) {
    const miss = toNum(p.ps.miss);
    if (miss === null || p.legs === null) return null;
    return p.legs + miss ? p.legs / (p.legs + miss) : null;   // nie aufs Doppel geworfen: –
  }, function (v, p) { return Math.round(v * 100) + " % (" + p.legs + "/" + (p.legs + toNum(p.ps.miss)) + ")"; }, true],
  ["High Finish", function (p) { return toNum(p.ps.co); }, String, true],
  ["Kürzestes Leg", function (p) { return toNum(p.ps.leg); }, function (v) { return v + " Darts"; }, false],
  ["100+", function (p) { return toNum(p.ps.t100); }, String, true],
  ["140+", function (p) { return toNum(p.ps.t140); }, String, true],
  ["180er", function (p) { return toNum(p.ps.n180); }, String, true],
];

// Welche Seite ist besser? -1 = keine
function betterSide(va, vb, more) {
  const has = function (v) { return v !== null && v !== undefined; };
  if (has(va) && has(vb) && va !== vb) return (more ? va > vb : va < vb) ? 0 : 1;
  if (has(va) !== has(vb) && (va || vb)) return has(va) ? 0 : 1;   // nur einer hat einen Wert, z. B. High Finish
  return -1;
}

// info: { mt (ausgewertetes Spiel), nr, datum, season?, modus?, standard? }
export function openMatchReport(info) {
  const mt = info.mt;
  const dlg = getDialog("match-dialog");
  dlg.setAttribute("aria-label", "Spielbericht");
  dlg.innerHTML = "";

  // Sieger links
  const aWon = mt.winner === mt.a.name;
  const names = aWon ? [mt.a.name, mt.b.name] : [mt.b.name, mt.a.name];
  const legsOf = function (n) {
    if (!mt.score) return null;
    return n === mt.a.name ? mt.score.a : mt.score.b;
  };
  const side = function (n) { return { name: n, legs: legsOf(n), ps: (mt.stats && mt.stats[n]) || {} }; };
  const pa = side(names[0]), pb = side(names[1]);

  // Kopf
  const where = [info.season, "Spieltag " + info.nr, info.datum].filter(Boolean).join(" · ");
  const head = el("div", { class: "pc-head" }, [
    el("div", { class: "pc-title" }, [
      el("h2", { text: LABELS[mt.id] || mt.id }),
      el("p", { class: "sub dash", text: where }),
    ]),
    closeButton(dlg),
  ]);
  const hero = el("div", { class: "zl-hero" }, [
    el("div", { class: "zl-hero-row" }, [
      el("div", { class: "zl-hero-side win" }, [profileAvatar(pa.name), el("b", { text: pa.name })]),
      mt.score
        ? el("div", { class: "zl-hero-score" }, [
            el("span", { class: "win", text: String(pa.legs) }),
            el("span", { class: "sep", text: ":" }),
            el("span", { text: String(pb.legs) }),
          ])
        : el("div", { class: "mr-won", text: "Sieg" }),
      el("div", { class: "zl-hero-side" }, [profileAvatar(pb.name), el("b", { text: pb.name })]),
    ]),
  ]);

  // Legverlauf
  const legs = mt.verlauf && mt.verlauf.length ? el("div", { class: "zl-legs" }, mt.verlauf.map(function (leg, k) {
    return el("div", { class: "zl-leg" + (leg.winner === pa.name ? " win" : "") }, [
      el("span", { class: "zl-leg-nr", text: "Leg " + (k + 1) }),
      el("b", { text: leg.winner }),
      leg.darts !== null ? el("span", { text: leg.darts + " Darts" }) : null,
      leg.checkout !== null ? el("span", { text: "Checkout " + leg.checkout }) : null,
    ]);
  })) : null;

  // Werte nebeneinander; Zeilen ohne Werte fallen weg
  const rows = ROWS.map(function (row) {
    const va = row[1](pa), vb = row[1](pb);
    if (va === null && vb === null) return null;
    const better = betterSide(va, vb, row[3]);
    const cell = function (v, p, i) {
      return el("span", { class: "zl-val" + (better === i ? " better" : ""), text: v !== null ? row[2](v, p) : "–" });
    };
    return el("div", { class: "zl-stat" }, [cell(va, pa, 0), el("span", { class: "zl-stat-label", text: row[0] }), cell(vb, pb, 1)]);
  }).filter(Boolean);
  const table = rows.length ? el("div", { class: "zl-stats" }, [
    el("div", { class: "zl-stat head" }, [el("b", { text: pa.name }), el("span"), el("b", { text: pb.name })]),
  ].concat(rows)) : null;

  // Hinweise
  const notes = [];
  if (!rows.length) notes.push(mt.score ? "Für dieses Spiel wurden nur die Legs eingetragen." : "Für dieses Spiel wurde nur der Sieger eingetragen.");
  else if (!legs) notes.push("Legverlauf, High Finish und 180er pro Spiel werden erst für neue Spiele aus dem Live-Zähler gespeichert.");
  if (info.standard === false && info.modus) notes.push("Spezial-Modus (" + modusText(info.modus) + "): Average und kürzestes Leg zählen nicht für die Saisonstatistik.");

  dlg.appendChild(el("div", { class: "pc match-report" }, [
    head,
    hero,
    legs,
    table,
    notes.length ? el("p", { class: "note mr-note", text: notes.join(" ") }) : null,
    el("div", { class: "mr-actions" }, [
      el("button", { type: "button", class: "btn", text: "Direktvergleich ›", title: pa.name + " und " + pb.name + " vergleichen",
        onclick: function () { dlg.close(); openCompare(pa.name, pb.name); } }),
    ]),
  ]));
  openDialog(dlg);
}
