// =====================================================================
//  Live-Zähler: Vollbild-Fenster für ein Spiel
//  Ablauf: Ausbullen → Aufnahmen eintippen → Zusammenfassung → übernehmen
//  Ein laufendes Spiel wird bei jeder Eingabe auf dem Gerät gespeichert
//  und beim nächsten „Zählen“ fortgesetzt.
// =====================================================================
import { LABELS } from "../kern/konstanten.js";
import { el, getDialog, openDialog } from "../kern/dom.js";
import { store, load } from "../kern/hilfen.js";
import { state, render } from "../kern/zustand.js";
import { matchFormat, bestOf, AUS_NAMEN } from "../auswertung/modus.js";
import { dayIdxByNr } from "../anzeige/navigation.js";
import { openAdmin } from "../bearbeiten/anmeldung.js";
import { minDarts, checkoutWeg } from "./checkout.js";
import { newMatch, replay, checkVisit, checkoutDoubles, addVisit, undo, summary, isStandard } from "./spiel.js";
import { applyToDay, hasResult, resultText } from "./uebernehmen.js";

const STORE_KEY = "liga.zaehler";
const QUICK = [26, 41, 45, 60, 81, 85, 100, 140, 180];

// Laufendes Spiel: { liga, nr, id, match } – match ist null bis zum Ausbullen
let cur = null;
// Bildschirm: "setup", "play", "ask" (Rückfrage) oder "done"
const ui = { input: "", error: "", ask: null, editFormat: false };

function saveCur() { store(STORE_KEY, cur ? JSON.stringify(cur) : null); }
function loadCur() {
  try { return JSON.parse(load(STORE_KEY) || "null"); } catch (e) { return null; }
}

function matchLabel(c) { return "Spieltag " + c.nr + " · " + LABELS[c.id]; }

// ---------------------------------------------------------------------
//  Einstieg: Knopf „Zählen“ an einem offenen Spiel
// ---------------------------------------------------------------------
export function scoreButton(day, match) {
  return el("button", { type: "button", class: "zaehlen", text: "▶ Live zählen", title: "Live-Zähler für dieses Spiel öffnen",
    onclick: function (e) { e.stopPropagation(); openScorer(day, match); } });
}

export function openScorer(day, match) {
  const key = { liga: state.liga.name || "", nr: day.nr, id: match.id, players: [match.a.name, match.b.name] };
  const saved = loadCur();
  const same = saved && saved.liga === key.liga && saved.nr === key.nr && saved.id === key.id &&
    JSON.stringify(saved.players) === JSON.stringify(key.players);
  if (saved && !same && saved.match && saved.match.events.length) {
    if (!confirm("Es ist noch ein anderes Spiel gespeichert (" + matchLabel(saved) + ": " + saved.players.join(" gegen ") +
      "). Verwerfen und dieses Spiel zählen?")) return;
  }
  cur = same ? saved : Object.assign(key, { match: null, format: matchFormat(day, state.liga, match.id) });
  ui.input = ""; ui.error = ""; ui.ask = null; ui.editFormat = false;
  saveCur();
  const dlg = getDialog("zaehler-dialog");
  dlg.setAttribute("aria-label", "Live-Zähler");
  draw();
  openDialog(dlg);
}

// ---------------------------------------------------------------------
//  Zeichnen
// ---------------------------------------------------------------------
function draw() {
  const dlg = getDialog("zaehler-dialog");
  dlg.innerHTML = "";
  const s = cur.match ? replay(cur.match) : null;
  dlg.appendChild(el("div", { class: "zl-bar" }, [
    el("button", { type: "button", class: "btn", text: "← Zurück", onclick: function () { dlg.close(); } }),
    el("span", { class: "zl-title", text: matchLabel(cur) }),
    el("span", { class: "zl-format", text: formatText(cur.match ? cur.match.format : cur.format) }),
  ]));
  let body;
  if (!s) body = setupView();
  else if (s.done) body = doneView(s);
  else body = playView(s);
  dlg.appendChild(el("div", { class: "zl-body" }, [body]));
}

function formatText(f) {
  return f.start + (f.ein === "double" ? " Double In" : "") + " " + AUS_NAMEN[f.aus] + " · " + bestOf(f.legsToWin);
}

// ---------- Ausbullen ----------
function setupView() {
  const f = cur.format;
  const kids = [
    el("h2", { text: cur.players[0] + " gegen " + cur.players[1] }),
    el("p", { class: "note", text: "Wer hat das Ausbullen gewonnen? Der beginnt das erste Leg, danach wechselt der Anwurf." }),
    el("div", { class: "zl-start" }, cur.players.map(function (n, i) {
      return el("button", { type: "button", class: "btn primary", text: n + " beginnt", onclick: function () {
        cur.match = newMatch(cur.players, i, cur.format);
        saveCur(); draw();
      } });
    })),
  ];
  // Format nur für dieses Spiel ändern (z. B. spontan First to 1)
  if (!ui.editFormat) {
    kids.push(el("button", { type: "button", class: "linkbtn", text: "Format für dieses Spiel ändern", onclick: function () { ui.editFormat = true; draw(); } }));
  } else {
    const startIn = el("input", { type: "text", inputmode: "numeric", class: "st-in", value: String(f.start), "aria-label": "Startpunkte" });
    const legsIn = el("input", { type: "text", inputmode: "numeric", class: "st-in", value: String(f.legsToWin), "aria-label": "Gewinnlegs" });
    const msg = el("p", { class: "status" });
    kids.push(el("div", { class: "zl-formatedit" }, [
      el("label", null, [document.createTextNode("Startpunkte"), startIn]),
      el("label", null, [document.createTextNode("Gewinnlegs"), legsIn]),
      el("button", { type: "button", class: "btn", text: "Übernehmen", onclick: function () {
        const st = parseInt(startIn.value, 10), lg = parseInt(legsIn.value, 10);
        if (!(st >= 2 && st <= 1001)) { msg.className = "status err"; msg.textContent = "Startpunkte zwischen 2 und 1001 eintragen."; return; }
        if (!(lg >= 1 && lg <= 9)) { msg.className = "status err"; msg.textContent = "Gewinnlegs zwischen 1 und 9 eintragen."; return; }
        cur.format = Object.assign({}, f, { start: st, legsToWin: lg });
        ui.editFormat = false; saveCur(); draw();
      } }),
    ]), msg);
  }
  return el("div", { class: "zl-setup" }, kids);
}

// ---------- Spielen ----------
function playView(s) {
  const m = cur.match;
  const sum = summary(m);
  const panels = el("div", { class: "zl-players" }, [0, 1].map(function (i) {
    const st = s.stats[i];
    return el("div", { class: "zl-player" + (s.turn === i ? " active" : "") }, [
      el("div", { class: "zl-name" }, [
        el("span", { text: m.players[i] + (s.legStarter === i ? " •" : "") , title: s.legStarter === i ? "hat in diesem Leg angeworfen" : null }),
        el("b", { class: "zl-legs", text: String(s.legs[i]) }),
      ]),
      el("div", { class: "zl-rest", text: String(s.rest[i]) }),
      el("div", { class: "zl-sub", text: "Ø " + (sum[i].avg !== null ? sum[i].avg.toFixed(1).replace(".", ",") : "–") + " · " + st.darts + " Darts" }),
      el("div", { class: "zl-sub", text: st.visits.length ? "zuletzt: " + st.visits.slice(-3).join(" · ") : " " }),
    ]);
  }));

  const rest = s.rest[s.turn];
  const weg = minDarts(rest, m.format.aus) !== null ? checkoutWeg(rest, m.format.aus) : null;
  let info = m.players[s.turn] + " wirft";
  if (weg) info += " · Checkout: " + weg.join(" ");
  if (m.format.ein === "double" && rest === m.format.start) info += " · Double In: nur zählende Punkte eintragen";
  const kids = [panels];
  if (s.lastLeg && m.events.length && s.rest[0] === m.format.start && s.rest[1] === m.format.start) {
    kids.push(el("p", { class: "zl-legwon", text: "Leg an " + m.players[s.lastLeg.winner] + " (" + s.lastLeg.checkout + " Checkout, " + s.lastLeg.darts + " Darts)" }));
  }
  kids.push(el("p", { class: "zl-info" + (weg ? " finish" : ""), text: info }));
  if (ui.ask) kids.push(askView(s));
  else kids.push(keypad(s));
  return el("div", null, kids);
}

function keypad(s) {
  const display = el("div", { class: "zl-display" + (ui.error ? " err" : ""), text: ui.error || ui.input || "0" });
  const key = function (label, cls, fn, aria) {
    return el("button", { type: "button", class: "zl-key" + (cls ? " " + cls : ""), text: label, "aria-label": aria || null, onclick: fn });
  };
  const digit = function (d) { return key(String(d), "", function () { typeDigit(String(d)); }); };
  return el("div", { class: "zl-pad" }, [
    el("div", { class: "zl-inputrow" }, [display, key("Bust", "bust", function () { submit(null, true); }, "Überworfen")]),
    el("div", { class: "zl-keys" }, [
      digit(1), digit(2), digit(3), digit(4), digit(5), digit(6), digit(7), digit(8), digit(9),
      key("⌫", "", backspace, ui.input ? "Letzte Ziffer löschen" : "Letzte Aufnahme rückgängig"),
      digit(0),
      key("OK", "ok", function () { submit(null, false); }),
    ]),
    el("div", { class: "zl-quick" }, QUICK.map(function (q) {
      return el("button", { type: "button", class: "zl-q", text: String(q), onclick: function () { submit(q, false); } });
    })),
    el("button", { type: "button", class: "linkbtn zl-discard", text: "Spiel verwerfen", onclick: discard }),
  ]);
}

function typeDigit(d) {
  ui.error = "";
  if (ui.input.length < 3) ui.input = (ui.input === "0" ? "" : ui.input) + d;
  draw();
}

function backspace() {
  ui.error = "";
  if (ui.input) ui.input = ui.input.slice(0, -1);
  else if (cur.match.events.length) { undo(cur.match); saveCur(); }
  draw();
}

// Aufnahme abschicken; bust = Knopf „Bust“
function submit(quick, bust) {
  const m = cur.match, s = replay(m);
  const score = quick !== null ? quick : parseInt(ui.input || "0", 10);
  const c = checkVisit(m, s, score);
  if (c.error && !bust) { ui.error = c.error; ui.input = ""; draw(); return; }
  if (bust) {
    // Überworfen: Punkte zählen nicht; Darts aufs Doppel wie bei jeder Aufnahme auf einem Finish
    const opts = checkVisit(m, s, 0).doubleOptions;
    return opts ? askFor({ score: score || 0, bust: true, doubleOptions: opts }) : commit(score || 0, true, 3, 0);
  }
  if (c.checkout) {
    if (c.dartOptions.length === 1) {
      const d = checkoutDoubles(c, c.dartOptions[0]);
      return d && d.length > 1 ? askFor({ score: score, checkout: c, darts: c.dartOptions[0], doubleOptions: d }) : commit(score, false, c.dartOptions[0], d ? 1 : 0);
    }
    return askFor({ score: score, checkout: c, darts: null });
  }
  if (c.doubleOptions) return askFor({ score: score, bust: c.bust, doubleOptions: c.doubleOptions });
  commit(score, c.bust, 3, 0);
}

function askFor(a) { ui.ask = a; ui.input = ""; ui.error = ""; draw(); }

function commit(score, bust, darts, doubles) {
  addVisit(cur.match, score, bust, darts, doubles);
  ui.ask = null; ui.input = ""; ui.error = "";
  saveCur(); draw();
}

// ---------- Rückfragen: Checkout-Dart, Darts aufs Doppel ----------
function askView(s) {
  const a = ui.ask, m = cur.match;
  const name = m.players[s.turn];
  const dbl = m.format.aus === "master" ? "Darts aufs Finish" : "Darts aufs Doppel";
  const kids = [];
  if (a.checkout && a.darts === null) {
    kids.push(el("p", { class: "zl-q-title", text: "Checkout " + a.score + "! Mit dem wievielten Dart?" }));
    kids.push(choiceRow(a.checkout.dartOptions, function (d) { return d + "."; }, function (d) {
      const opts = checkoutDoubles(a.checkout, d);
      if (!opts || opts.length === 1) commit(a.score, false, d, opts ? 1 : 0);
      else { a.darts = d; a.doubleOptions = opts; draw(); }
    }));
  } else {
    kids.push(el("p", { class: "zl-q-title", text: (a.checkout ? "Checkout " + a.score + " mit dem " + a.darts + ". Dart. " : a.bust ? "Bust. " : a.score + " geworfen. ") + dbl + " (" + name + ")?" }));
    kids.push(choiceRow(a.doubleOptions, String, function (d) {
      commit(a.score, !!a.bust, a.checkout ? a.darts : 3, d);
    }));
  }
  kids.push(el("button", { type: "button", class: "linkbtn", text: "Abbrechen", onclick: function () { ui.ask = null; draw(); } }));
  return el("div", { class: "zl-ask" }, kids);
}

function choiceRow(values, label, onPick) {
  return el("div", { class: "zl-choices" }, values.map(function (v) {
    return el("button", { type: "button", class: "zl-key", text: label(v), onclick: function () { onPick(v); } });
  }));
}

function discard() {
  if (!confirm("Das gezählte Spiel wirklich verwerfen?")) return;
  cur = null; saveCur(); getDialog("zaehler-dialog").close();
}

// ---------- Zusammenfassung ----------
function doneView(s) {
  const m = cur.match;
  const sum = summary(m);
  const standard = isStandard(m.format);
  const row = function (label, f) {
    return el("tr", null, [el("td", { class: "dash", text: label })].concat(sum.map(function (p) { return el("td", { class: "num", text: f(p) }); })));
  };
  const quote = function (p) { return p.doubles ? Math.round(p.checkouts / p.doubles * 100) + " %" : "–"; };
  const rows = [
    row("Legs", function (p) { return String(p.legs); }),
    row("Average", function (p) { return p.avg !== null ? p.avg.toFixed(2).replace(".", ",") : "–"; }),
    row("Darts", function (p) { return String(p.darts); }),
    row("Checkout-Quote", quote),
    row("High Finish", function (p) { return p.hiCo !== null ? String(p.hiCo) : "–"; }),
    row("Kürzestes Leg", function (p) { return p.bestLeg !== null ? p.bestLeg + " Darts" : "–"; }),
    row("180er", function (p) { return String(p.n180); }),
  ];
  const msg = el("p", { class: "status" });
  const idx = dayIdxByNr(cur.nr);
  const day = idx >= 0 ? state.days[idx] : null;
  const actions = [];
  if (state.editing) {
    actions.push(el("button", { type: "button", class: "btn primary", text: "Ins Ergebnis übernehmen", onclick: function () {
      if (!day) { msg.className = "status err"; msg.textContent = "Spieltag " + cur.nr + " gibt es nicht mehr."; return; }
      const err = applyToDay(day, cur.id, m);
      if (err) { msg.className = "status err"; msg.textContent = err; return; }
      cur = null; saveCur();
      getDialog("zaehler-dialog").close();
      state.currentIdx = idx;
      state.dirty = true;
      state.statusText = "Ergebnis übernommen. Zum Speichern unten auf „Speichern“ tippen.";
      state.statusKind = "ok";
      render();
    } }));
  } else {
    actions.push(el("button", { type: "button", class: "btn primary", text: "Anmelden zum Übernehmen", onclick: function () {
      getDialog("zaehler-dialog").close();
      openAdmin(false);
    } }));
  }
  actions.push(el("button", { type: "button", class: "btn", text: "Ergebnis kopieren", onclick: function () {
    const text = resultText(matchLabel(cur), m);
    const done = function () { msg.className = "status ok"; msg.textContent = "Kopiert."; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { prompt("Zum Kopieren:", text); });
    else prompt("Zum Kopieren:", text);
  } }));
  actions.push(el("button", { type: "button", class: "btn", text: "Letzte Aufnahme rückgängig", onclick: function () { undo(m); saveCur(); draw(); } }));
  actions.push(el("button", { type: "button", class: "linkbtn", text: "Spiel verwerfen", onclick: discard }));

  const notes = [];
  if (!standard) notes.push("Spezial-Modus: Average und kürzestes Leg werden nicht in die Statistik übernommen.");
  if (!state.editing) notes.push("Das Spiel bleibt auf diesem Gerät gespeichert. Nach dem Anmelden hier wieder auf „Zählen“ tippen und übernehmen.");
  if (day && hasResult(day, cur.id)) notes.push("Achtung: Für dieses Spiel ist schon ein Ergebnis eingetragen.");

  return el("div", { class: "zl-done" }, [
    el("h2", { text: m.players[s.winner] + " gewinnt " + Math.max(s.legs[0], s.legs[1]) + ":" + Math.min(s.legs[0], s.legs[1]) }),
    el("table", { class: "mini zl-sum" }, [
      el("thead", null, [el("tr", null, [el("th", { text: "" })].concat(sum.map(function (p) { return el("th", { class: "num", text: p.name }); })))]),
      el("tbody", null, rows),
    ]),
    notes.length ? el("p", { class: "note", text: notes.join(" ") }) : null,
    el("div", { class: "row" }, actions),
    msg,
  ]);
}

// ---------------------------------------------------------------------
//  Tastatur (Computer): Ziffern, Enter, Rücktaste
// ---------------------------------------------------------------------
export function initScorer() {
  // Auf dem ganzen Dokument, weil beim Neuzeichnen der Fokus verloren geht
  document.addEventListener("keydown", function (e) {
    const dlg = document.getElementById("zaehler-dialog");
    if (!dlg || !dlg.open || !cur || !cur.match || ui.ask || replay(cur.match).done) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); typeDigit(e.key); }
    else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
    else if (e.key === "Enter") { e.preventDefault(); submit(null, false); }
  });
}
