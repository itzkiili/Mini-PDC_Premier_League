// =====================================================================
//  Live-Zähler: Vollbild-Fenster für ein Spiel
//  Ablauf: Ausbullen → Aufnahmen eintippen → Endbildschirm → übernehmen
//  Ein laufendes Spiel wird bei jeder Eingabe auf dem Gerät gespeichert
//  und beim nächsten „Live zählen“ fortgesetzt.
// =====================================================================
import { LABELS } from "../kern/konstanten.js";
import { el, getDialog, openDialog } from "../kern/dom.js";
import { store, load } from "../kern/hilfen.js";
import { state, render } from "../kern/zustand.js";
import { matchFormat, bestOf, AUS_NAMEN } from "../auswertung/modus.js";
import { dayIdxByNr } from "../anzeige/navigation.js";
import { profileAvatar } from "../anzeige/profil.js";
import { openAdmin } from "../bearbeiten/anmeldung.js";
import { minDarts, checkoutWeg } from "./checkout.js";
import { newMatch, replay, checkVisit, checkoutDoubles, addVisit, undo, summary, isStandard } from "./spiel.js";
import { applyToDay, hasResult, resultText } from "./uebernehmen.js";

const STORE_KEY = "liga.zaehler";
const QUICK = [0, 26, 41, 45, 60, 81, 85, 100, 140, 180];

// Laufendes Spiel: { liga, nr, id, players, format, match } – match ist null bis zum Ausbullen
let cur = null;
// Zustand des Bildschirms (wird nicht gespeichert)
const ui = { input: "", error: "", ask: null, editFormat: false, menu: false, msg: null };

function saveCur() { store(STORE_KEY, cur ? JSON.stringify(cur) : null); }
function loadCur() {
  try { return JSON.parse(load(STORE_KEY) || "null"); } catch (e) { return null; }
}

function matchLabel(c) { return LABELS[c.id] + " · Spieltag " + c.nr; }
function fmtAvg(v) { return v === null ? "–" : v.toFixed(1).replace(".", ","); }
function isFinish(rest, aus) { return rest <= 180 && minDarts(rest, aus) !== null; }

function sameFormat(a, b) {
  return a.start === b.start && a.ein === b.ein && a.aus === b.aus && a.legsToWin === b.legsToWin;
}

function formatText(f) {
  return f.start + (f.ein === "double" ? " Double In" : "") + " " + AUS_NAMEN[f.aus] + " · " + bestOf(f.legsToWin);
}

function btn(text, cls, onclick, attrs) {
  return el("button", Object.assign({ type: "button", class: "zl-btn" + (cls ? " " + cls : ""), text: text, onclick: onclick }, attrs || {}));
}

// ---------------------------------------------------------------------
//  Einstieg: Knopf „Live zählen“ an einem offenen Spiel
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
  const format = matchFormat(day, state.liga, match.id);
  cur = same ? saved : Object.assign(key, { match: null, format: format });
  // Spielmodus seit dem letzten Öffnen geändert? (Ein von Hand geändertes Format bleibt.)
  if (same && !cur.customFormat && !sameFormat(cur.format, format)) {
    const started = cur.match && cur.match.events.length;
    if (!started) {
      cur.format = format;
      if (cur.match) cur.match.format = Object.assign({}, format);
    } else if (confirm("Der Spielmodus wurde geändert: jetzt " + formatText(format) + " statt " + formatText(cur.format) +
        ".\n\nOK = Spiel mit dem neuen Modus von vorn beginnen\nAbbrechen = im bisherigen Modus weiterzählen")) {
      cur.format = format;
      cur.match = null;
    } else {
      cur.customFormat = true;   // nicht bei jedem Öffnen wieder fragen
    }
  }
  Object.assign(ui, { input: "", error: "", ask: null, editFormat: false, menu: false, msg: null });
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
  dlg.appendChild(topBar(s));
  let body;
  if (!s) body = setupView();
  else if (s.done) body = doneView(s);
  else body = playView(s);
  dlg.appendChild(el("div", { class: "zl-body" }, [body]));
}

function topBar(s) {
  const dlg = getDialog("zaehler-dialog");
  const f = cur.match ? cur.match.format : cur.format;
  const bar = el("div", { class: "zl-bar" }, [
    btn("✕", "zl-icon", function () { dlg.close(); }, { "aria-label": "Zähler schließen (das Spiel bleibt gespeichert)", title: "Schließen – das Spiel bleibt gespeichert" }),
    el("div", { class: "zl-bar-text" }, [
      el("span", { class: "zl-title", text: matchLabel(cur) }),
      el("span", { class: "zl-format", text: formatText(f) }),
    ]),
    s ? btn("⋯", "zl-icon", function () { ui.menu = !ui.menu; draw(); }, { "aria-label": "Mehr", "aria-expanded": ui.menu ? "true" : "false" }) : el("span", { class: "zl-icon-space" }),
  ]);
  if (!ui.menu || !s) return bar;
  return el("div", null, [bar, el("div", { class: "zl-menu" }, [
    btn("Letzte Aufnahme rückgängig", "", function () { ui.menu = false; undoLast(); }, { disabled: cur.match.events.length ? null : "disabled" }),
    btn("Spiel verwerfen", "danger", function () { ui.menu = false; discard(); }),
  ])]);
}

// ---------------------------------------------------------------------
//  Ausbullen
// ---------------------------------------------------------------------
function setupView() {
  const f = cur.format;
  const kids = [
    el("p", { class: "zl-kicker", text: "Ausbullen" }),
    el("h2", { class: "zl-h", text: "Wer beginnt das erste Leg?" }),
    el("div", { class: "zl-start" }, cur.players.map(function (n, i) {
      return el("button", { type: "button", class: "zl-starter", onclick: function () {
        cur.match = newMatch(cur.players, i, cur.format);
        saveCur(); draw();
      } }, [profileAvatar(n), el("b", { text: n }), el("span", { text: "beginnt" })]);
    })),
    el("p", { class: "zl-hint", text: "Danach wechselt der Anwurf jedes Leg." }),
  ];
  // Format nur für dieses Spiel ändern (z. B. spontan First to 1)
  const fmt = el("div", { class: "zl-fmtbox" }, [
    el("div", null, [el("span", { class: "zl-label", text: "Format" }), el("b", { text: formatText(f) })]),
    ui.editFormat ? null : btn("Ändern", "small", function () { ui.editFormat = true; draw(); }),
  ]);
  kids.push(fmt);
  if (ui.editFormat) {
    const startIn = el("input", { type: "text", inputmode: "numeric", value: String(f.start), "aria-label": "Startpunkte" });
    const legsIn = el("input", { type: "text", inputmode: "numeric", value: String(f.legsToWin), "aria-label": "Gewinnlegs" });
    const msg = el("p", { class: "zl-error" });
    kids.push(el("div", { class: "zl-fmtedit" }, [
      el("label", null, [el("span", { text: "Startpunkte" }), startIn]),
      el("label", null, [el("span", { text: "Gewinnlegs" }), legsIn]),
      btn("Übernehmen", "primary", function () {
        const st = parseInt(startIn.value, 10), lg = parseInt(legsIn.value, 10);
        if (!(st >= 2 && st <= 1001)) { msg.textContent = "Startpunkte zwischen 2 und 1001 eintragen."; return; }
        if (!(lg >= 1 && lg <= 9)) { msg.textContent = "Gewinnlegs zwischen 1 und 9 eintragen."; return; }
        cur.format = Object.assign({}, f, { start: st, legsToWin: lg });
        cur.customFormat = true;
        ui.editFormat = false; saveCur(); draw();
      }),
    ]), msg);
  }
  return el("div", { class: "zl-setup" }, kids);
}

// ---------------------------------------------------------------------
//  Spielen
// ---------------------------------------------------------------------
function playView(s) {
  const m = cur.match;
  const sum = summary(m);
  const board = el("div", { class: "zl-board" }, [0, 1].map(function (i) { return playerPanel(s, sum, i); }));
  const kids = [board];
  const legStart = m.events.length && s.rest[0] === m.format.start && s.rest[1] === m.format.start;
  if (legStart && s.lastLeg) {
    kids.push(el("div", { class: "zl-banner" }, [
      el("b", { text: "Leg an " + m.players[s.lastLeg.winner] }),
      el("span", { text: s.lastLeg.checkout + " Checkout · " + s.lastLeg.darts + " Darts · " + s.legs[0] + ":" + s.legs[1] }),
    ]));
  }
  kids.push(inputArea(s));
  return el("div", { class: "zl-play" }, kids);
}

function playerPanel(s, sum, i) {
  const m = cur.match;
  const active = s.turn === i;
  const rest = s.rest[i];
  const weg = isFinish(rest, m.format.aus) ? checkoutWeg(rest, m.format.aus) : null;
  const st = s.stats[i];
  const pips = m.format.legsToWin <= 5
    ? el("span", { class: "zl-pips", "aria-label": s.legs[i] + " Legs" }, Array.from({ length: m.format.legsToWin }, function (_, k) {
        return el("i", { class: k < s.legs[i] ? "on" : "" });
      }))
    : el("span", { class: "zl-legnum", text: s.legs[i] + " / " + m.format.legsToWin });
  return el("div", { class: "zl-panel" + (active ? " active" : ""), "aria-current": active ? "true" : null }, [
    el("div", { class: "zl-panel-head" }, [
      el("span", { class: "zl-pname", text: m.players[i] }),
      s.legStarter === i ? el("span", { class: "zl-throw", text: "Anwurf", title: "Hat in diesem Leg angeworfen" }) : null,
    ]),
    pips,
    el("div", { class: "zl-rest", text: String(rest) }),
    el("div", { class: "zl-way", text: weg ? weg.join(" · ") : " " }),
    el("div", { class: "zl-pstats" }, [
      el("span", { text: "Ø " + fmtAvg(sum[i].avg) }),
      el("span", { text: st.darts + " Darts" }),
    ]),
    el("div", { class: "zl-visits" }, st.visits.slice(-4).map(function (v) {
      return el("span", { class: v === "Bust" ? "bust" : v === "180" ? "max" : "", text: v });
    })),
  ]);
}

// ---------- Eingabe ----------
function preview(s) {
  if (ui.error) return { text: ui.error, cls: "err" };
  if (!ui.input) return { text: cur.match.players[s.turn] + " ist dran", cls: "muted" };
  const score = parseInt(ui.input, 10);
  const c = checkVisit(cur.match, s, score);
  if (c.error) return { text: c.error, cls: "err" };
  if (c.checkout) return { text: "Checkout!", cls: "good" };
  if (c.bust) return { text: "Bust", cls: "err" };
  return { text: "Rest " + (s.rest[s.turn] - score), cls: "" };
}

function inputArea(s) {
  const m = cur.match;
  const rest = s.rest[s.turn];
  const canCheck = isFinish(rest, m.format.aus);
  const pv = preview(s);
  const hint = m.format.ein === "double" && rest === m.format.start ? "Double In: nur die zählenden Punkte eintragen" : null;

  const key = function (label, cls, fn, aria) {
    return el("button", { type: "button", class: "zl-key" + (cls ? " " + cls : ""), text: label, "aria-label": aria || null, onclick: fn });
  };
  const digit = function (d) { return key(String(d), "", function () { typeDigit(String(d)); }); };

  const area = el("div", { class: "zl-input" }, [
    el("div", { class: "zl-display" }, [
      el("span", { class: "zl-typed" + (ui.input ? "" : " empty"), text: ui.input || "0" }),
      el("span", { class: "zl-preview " + pv.cls, text: pv.text }),
    ]),
    hint ? el("p", { class: "zl-hint", text: hint }) : null,
    el("div", { class: "zl-quick" }, QUICK.map(function (q) {
      return el("button", { type: "button", class: "zl-chip" + (q === 180 ? " max" : ""), text: String(q), onclick: function () { submit(q, false); } });
    })),
    el("div", { class: "zl-keys" }, [
      digit(1), digit(2), digit(3), key("⌫", "fn", backspace, "Ziffer löschen"),
      digit(4), digit(5), digit(6), key("↶", "fn", undoLast, "Letzte Aufnahme rückgängig"),
      digit(7), digit(8), digit(9), key("Bust", "fn bust", function () { submit(null, true); }, "Überworfen"),
      el("button", { type: "button", class: "zl-key fn check", disabled: canCheck ? null : "disabled",
        "aria-label": canCheck ? rest + " auschecken" : "Kein Checkout möglich", onclick: function () { submit(rest, false); } },
        [el("small", { text: "Check" }), document.createTextNode(canCheck ? String(rest) : "–")]),
      digit(0),
      key("OK", "ok", function () { submit(null, false); }),
    ]),
  ]);
  if (ui.ask) area.appendChild(askView(s));
  return area;
}

function typeDigit(d) {
  ui.error = "";
  if (ui.input.length < 3) ui.input = (ui.input === "0" ? "" : ui.input) + d;
  draw();
}

function backspace() {
  ui.error = "";
  ui.input = ui.input.slice(0, -1);
  draw();
}

function undoLast() {
  ui.error = ""; ui.input = ""; ui.ask = null;
  if (cur.match.events.length) { undo(cur.match); saveCur(); }
  draw();
}

// Aufnahme abschicken; bust = Knopf „Bust“
function submit(quick, bust) {
  const m = cur.match, s = replay(m);
  if (!bust && quick === null && ui.input === "") { ui.error = "Erst die Punkte eintippen."; draw(); return; }
  const score = quick !== null ? quick : parseInt(ui.input || "0", 10);
  const c = checkVisit(m, s, score);
  if (c.error && !bust) { ui.error = c.error; ui.input = ""; draw(); return; }
  if (bust) {
    // Überworfen: Punkte zählen nicht; Darts aufs Doppel wie bei jeder Aufnahme auf einem kurzen Finish
    const opts = checkVisit(m, s, 0).doubleOptions;
    return opts ? askFor({ score: score || 0, bust: true, doubleOptions: opts }) : commit(score || 0, true, 3, 0);
  }
  if (c.checkout) {
    if (c.dartOptions.length === 1) {
      const d = checkoutDoubles(c, c.dartOptions[0]);
      return d && d.length > 1 ? askFor({ score: score, checkout: c, darts: c.dartOptions[0], doubleOptions: d }) : commit(score, false, c.dartOptions[0], d ? d[0] : 0);
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

// ---------- Rückfragen: Checkout-Dart, Darts aufs Doppel (über der Tastatur) ----------
function askView(s) {
  const a = ui.ask, m = cur.match;
  const name = m.players[s.turn];
  const dbl = m.format.aus === "master" ? "Darts aufs Finish" : "Darts aufs Doppel";
  let title, sub, values, label, pick;
  if (a.checkout && a.darts === null) {
    title = "Checkout " + a.score + "!";
    sub = "Mit dem wievielten Dart?";
    values = a.checkout.dartOptions;
    label = function (d) { return d + ". Dart"; };
    pick = function (d) {
      const opts = checkoutDoubles(a.checkout, d);
      if (!opts || opts.length === 1) commit(a.score, false, d, opts ? opts[0] : 0);
      else { a.darts = d; a.doubleOptions = opts; draw(); }
    };
  } else {
    title = a.checkout ? "Checkout " + a.score + " mit dem " + a.darts + ". Dart" : a.bust ? "Bust" : a.score + " geworfen";
    sub = dbl + " – " + name;
    values = a.doubleOptions;
    label = String;
    pick = function (d) { commit(a.score, !!a.bust, a.checkout ? a.darts : 3, d); };
  }
  return el("div", { class: "zl-ask", role: "dialog", "aria-label": title }, [
    el("div", { class: "zl-ask-title" + (a.checkout ? " good" : a.bust ? " bad" : "") }, [el("b", { text: title }), el("span", { text: sub })]),
    el("div", { class: "zl-choices" }, values.map(function (v) {
      return el("button", { type: "button", class: "zl-key", text: label(v), onclick: function () { pick(v); } });
    })),
    btn("Abbrechen", "ghost", function () { ui.ask = null; draw(); }),
  ]);
}

function discard() {
  if (!confirm("Das gezählte Spiel wirklich verwerfen?")) return;
  cur = null; saveCur(); getDialog("zaehler-dialog").close();
}

// ---------------------------------------------------------------------
//  Endbildschirm
// ---------------------------------------------------------------------
function doneView(s) {
  const m = cur.match;
  const sum = summary(m);
  const w = s.winner, l = 1 - w;
  const idx = dayIdxByNr(cur.nr);
  const day = idx >= 0 ? state.days[idx] : null;

  // Kopf: Sieger und Ergebnis
  const hero = el("div", { class: "zl-hero" }, [
    el("p", { class: "zl-kicker", text: "Sieg" }),
    el("div", { class: "zl-hero-row" }, [
      el("div", { class: "zl-hero-side win" }, [profileAvatar(m.players[w]), el("b", { text: m.players[w] })]),
      el("div", { class: "zl-hero-score" }, [
        el("span", { class: "win", text: String(s.legs[w]) }),
        el("span", { class: "sep", text: ":" }),
        el("span", { text: String(s.legs[l]) }),
      ]),
      el("div", { class: "zl-hero-side" }, [profileAvatar(m.players[l]), el("b", { text: m.players[l] })]),
    ]),
  ]);

  // Legs der Reihe nach
  const legs = el("div", { class: "zl-legs" }, s.legList.map(function (leg, k) {
    return el("div", { class: "zl-leg" + (leg.winner === w ? " win" : "") }, [
      el("span", { class: "zl-leg-nr", text: "Leg " + (k + 1) }),
      el("b", { text: m.players[leg.winner] }),
      el("span", { text: leg.darts + " Darts" }),
      el("span", { text: "Checkout " + leg.checkout }),
    ]);
  }));

  // Statistik nebeneinander, besserer Wert hervorgehoben
  const quote = function (p) { return p.doubles ? p.checkouts / p.doubles : null; };
  const stats = [
    ["Average", function (p) { return p.avg; }, function (v) { return v.toFixed(2).replace(".", ","); }, true],
    ["First 9", function (p) { return p.f9; }, function (v) { return v.toFixed(2).replace(".", ","); }, true],
    ["Checkout", quote, function (v, p) { return Math.round(v * 100) + " %" + " (" + p.checkouts + "/" + p.doubles + ")"; }, true],
    ["High Finish", function (p) { return p.hiCo; }, String, true],
    ["Kürzestes Leg", function (p) { return p.bestLeg; }, function (v) { return v + " Darts"; }, false],
    ["100+", function (p) { return p.t100; }, String, true],
    ["140+", function (p) { return p.t140; }, String, true],
    ["180er", function (p) { return p.n180; }, String, true],
    ["Darts", function (p) { return p.darts; }, String, null],
  ];
  // Sieger links, wie oben
  const pa = sum[w], pb = sum[l];
  const table = el("div", { class: "zl-stats" }, [
    el("div", { class: "zl-stat head" }, [el("b", { text: pa.name }), el("span"), el("b", { text: pb.name })]),
  ].concat(stats.map(function (row) {
    const va = row[1](pa), vb = row[1](pb);
    const has = function (v) { return v !== null && v !== undefined; };
    let better = -1;
    if (row[3] !== null && has(va) && has(vb) && va !== vb) better = (row[3] ? va > vb : va < vb) ? 0 : 1;
    else if (row[3] !== null && has(va) !== has(vb) && (va || vb)) better = has(va) ? 0 : 1;
    const cell = function (v, p, i) { return el("span", { class: "zl-val" + (better === i ? " better" : ""), text: has(v) ? row[2](v, p) : "–" }); };
    return el("div", { class: "zl-stat" }, [cell(va, pa, 0), el("span", { class: "zl-stat-label", text: row[0] }), cell(vb, pb, 1)]);
  })));

  // Hinweise
  const notes = [];
  if (!isStandard(m.format)) notes.push("Spezial-Modus: Average, First 9 und kürzestes Leg werden nicht in die Statistik übernommen.");
  if (day && hasResult(day, cur.id)) notes.push("Für dieses Spiel ist schon ein Ergebnis eingetragen.");
  if (!state.editing) notes.push("Zum Übernehmen anmelden. Das Spiel bleibt so lange auf diesem Gerät gespeichert.");

  // Aktionen
  const msgEl = ui.msg ? el("p", { class: ui.msg.kind === "err" ? "zl-error" : "zl-ok", text: ui.msg.text }) : null;
  const primary = state.editing
    ? btn("Ins Ergebnis übernehmen", "primary big", function () {
        if (!day) { ui.msg = { kind: "err", text: "Spieltag " + cur.nr + " gibt es nicht mehr." }; draw(); return; }
        const err = applyToDay(day, cur.id, m);
        if (err) { ui.msg = { kind: "err", text: err }; draw(); return; }
        cur = null; saveCur();
        getDialog("zaehler-dialog").close();
        state.currentIdx = idx;
        state.dirty = true;
        state.statusText = "Ergebnis übernommen. Zum Speichern unten auf „Speichern“ tippen.";
        state.statusKind = "ok";
        render();
      })
    : btn("Anmelden zum Übernehmen", "primary big", function () {
        getDialog("zaehler-dialog").close();
        openAdmin(false);
      });

  return el("div", { class: "zl-done" }, [
    hero,
    legs,
    table,
    notes.length ? el("p", { class: "zl-hint", text: notes.join(" ") }) : null,
    msgEl,
    primary,
    el("div", { class: "zl-actions" }, [
      btn("Ergebnis kopieren", "", function () {
        const text = resultText(matchLabel(cur), m);
        const done = function () { ui.msg = { kind: "ok", text: "Ergebnis kopiert." }; draw(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { prompt("Zum Kopieren:", text); });
        else prompt("Zum Kopieren:", text);
      }),
      btn("↶ Letzte Aufnahme", "", function () { ui.msg = null; undoLast(); }),
    ]),
    btn("Spiel verwerfen", "ghost danger", discard),
  ]);
}

// ---------------------------------------------------------------------
//  Tastatur (Computer): Ziffern, Enter, Rücktaste, Esc bei Rückfragen
// ---------------------------------------------------------------------
export function initScorer() {
  // Auf dem ganzen Dokument, weil beim Neuzeichnen der Fokus verloren geht
  document.addEventListener("keydown", function (e) {
    const dlg = document.getElementById("zaehler-dialog");
    if (!dlg || !dlg.open || !cur || !cur.match || replay(cur.match).done) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ui.ask) {
      if (e.key === "Escape") { e.preventDefault(); ui.ask = null; draw(); }
      return;
    }
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); typeDigit(e.key); }
    else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
    else if (e.key === "Enter") { e.preventDefault(); submit(null, false); }
  });
}
