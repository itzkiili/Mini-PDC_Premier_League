// =====================================================================
//  Live Scoring: Zuschauen
//  - Leiste „Live“ über den Spieltagen mit allen laufenden Spielen
//  - „● LIVE“ am Spiel im Turnierbaum
//  - Live-Ansicht (Fenster, auf Tablet/Fernseher auch als Vollbild-Tafel),
//    auf Wunsch mit Caller-Ansagen
//  Jedes Handy rechnet den Spielstand selbst aus den Aufnahmen aus.
// =====================================================================
import { LABELS } from "../kern/konstanten.js";
import { el, getDialog, openDialog } from "../kern/dom.js";
import { state, render } from "../kern/zustand.js";
import { replay, summary } from "../zaehler/spiel.js";
import { playerPanel, formatText } from "../zaehler/anzeige.js";
import { callerAvailable, callerSettings, callsAfterVisit, speak, silence, warmUp } from "../zaehler/caller.js";
import { watchLive, liveEnabled } from "./verbindung.js";

const MAX_ALT = 3 * 60 * 60 * 1000;      // älter: nicht mehr anzeigen
const ENDE_ALT = 15 * 60 * 1000;         // beendete Spiele noch so lange zeigen

let games = {};        // Schlüssel -> { key, nr, id, players, match, done, updated }
let openKey = null;    // gerade geöffnete Live-Ansicht
let sound = false;     // Ansagen in der Live-Ansicht

// Firebase speichert Listen manchmal als Objekt { "0": …, "1": … }
function list(v) {
  if (Array.isArray(v)) return v.filter(function (x) { return x != null; });
  if (v && typeof v === "object") return Object.keys(v).sort(function (a, b) { return a - b; }).map(function (k) { return v[k]; });
  return [];
}

function normalize(key, v) {
  if (!v || typeof v !== "object" || !v.format || !v.players) return null;
  const players = list(v.players);
  if (players.length !== 2) return null;
  const match = { v: 1, players: players, starter: Number(v.starter) || 0, format: v.format, events: list(v.events) };
  let s;
  try { s = replay(match); } catch (e) { return null; }
  return { key: key, liga: v.liga || "", nr: Number(v.nr), id: String(v.id), players: players, match: match,
    done: s.done, updated: Number(v.updated) || 0 };
}

function visible(g) {
  if ((g.liga || "") !== (state.liga.name || "")) return false;   // andere Saison
  if (state.archiveView) return false;
  const age = Date.now() - g.updated;
  return age < (g.done ? ENDE_ALT : MAX_ALT);
}

function signature(map) {
  return Object.keys(map).sort().map(function (k) { return k + (map[k].done ? "!" : ""); }).join(",");
}

function onTree(tree) {
  const nextMap = {};
  Object.keys(tree || {}).forEach(function (k) {
    const g = normalize(k, tree[k]);
    if (g) nextMap[k] = g;
  });
  const before = games;
  games = nextMap;
  if (openKey) {
    announce(before[openKey], games[openKey]);
    drawLive();
  }
  // Leiste und Hinweise im Turnierbaum nur neu zeichnen, wenn sich etwas Sichtbares ändert
  if (signature(before) !== signature(games) || Object.keys(games).some(function (k) { return liveScore(before[k]) !== liveScore(games[k]); })) render();
}

export function initLive() {
  if (!liveEnabled()) return;
  watchLive(onTree);
}

// Laufendes Live-Spiel zu einem Spiel im Turnierbaum (oder null)
export function liveFor(nr, id) {
  const g = Object.keys(games).map(function (k) { return games[k]; })
    .filter(function (x) { return x.nr === nr && x.id === id && visible(x); })[0];
  return g || null;
}

function liveScore(g) {
  if (!g) return "";
  const s = replay(g.match);
  return s.legs[0] + ":" + s.legs[1];
}

// ---------------------------------------------------------------------
//  Leiste über den Spieltagen
// ---------------------------------------------------------------------
export function renderLiveBar() {
  const box = document.getElementById("live-bar");
  if (!box) return;
  box.innerHTML = "";
  const shown = Object.keys(games).map(function (k) { return games[k]; }).filter(visible)
    .sort(function (a, b) { return a.nr - b.nr || a.id.localeCompare(b.id); });
  box.hidden = !shown.length;
  shown.forEach(function (g) {
    const s = replay(g.match);
    box.appendChild(el("button", { type: "button", class: "live-chip" + (g.done ? " done" : ""), onclick: function () { openLive(g.key); },
      title: "Live ansehen" }, [
      el("span", { class: "live-dot", text: g.done ? "Beendet" : "● LIVE" }),
      el("span", { class: "live-what", text: (LABELS[g.id] || g.id) + " · ST " + g.nr }),
      el("b", { text: g.players[0] + " " + s.legs[0] + ":" + s.legs[1] + " " + g.players[1] }),
    ]));
  });
}

// ---------------------------------------------------------------------
//  Live-Ansicht
// ---------------------------------------------------------------------
export function openLive(key) {
  openKey = key;
  const dlg = getDialog("live-dialog");
  dlg.setAttribute("aria-label", "Live-Spiel");
  if (!dlg.dataset.ready) {
    dlg.dataset.ready = "1";
    dlg.addEventListener("close", function () {
      openKey = null; silence();
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    });
  }
  drawLive();
  openDialog(dlg);
}

// Ansage für die neueste Aufnahme (nur wenn genau eine dazukam)
function announce(prev, g) {
  if (!sound || !prev || !g) return;
  const a = prev.match.events.length, b = g.match.events.length;
  if (b !== a + 1) return;
  const m = g.match;
  const before = replay({ players: m.players, starter: m.starter, format: m.format, events: m.events.slice(0, -1) });
  speak(callsAfterVisit(m, before, replay(m), callerSettings().lang), callerSettings().lang);
}

function iconBtn(text, title, onclick, on) {
  return el("button", { type: "button", class: "zl-btn zl-icon" + (on ? " on" : ""), text: text, title: title, "aria-label": title, onclick: onclick });
}

function drawLive() {
  const dlg = getDialog("live-dialog");
  dlg.innerHTML = "";
  const g = games[openKey];
  const close = iconBtn("✕", "Schließen", function () { dlg.close(); });
  if (!g) {
    dlg.appendChild(el("div", { class: "zl-bar" }, [close, el("div", { class: "zl-bar-text" }, [el("span", { class: "zl-title", text: "Live" })]), el("span", { class: "zl-icon-space" })]));
    dlg.appendChild(el("div", { class: "zl-body" }, [el("p", { class: "live-empty", text: "Dieses Spiel wird gerade nicht mehr live übertragen. Das Ergebnis erscheint im Turnierbaum, sobald es gespeichert ist." })]));
    return;
  }
  const m = g.match;
  const s = replay(m);
  const sum = summary(m);
  const bar = el("div", { class: "zl-bar" }, [
    close,
    el("div", { class: "zl-bar-text" }, [
      el("span", { class: "zl-title" }, [el("span", { class: "live-dot", text: g.done ? "Beendet" : "● LIVE" }), document.createTextNode(" " + (LABELS[g.id] || g.id) + " · Spieltag " + g.nr)]),
      el("span", { class: "zl-format", text: formatText(m.format) }),
    ]),
    callerAvailable() ? iconBtn(sound ? "🔊" : "🔇", sound ? "Ansagen ausschalten" : "Ansagen einschalten", function () {
      sound = !sound;
      if (sound) warmUp(); else silence();
      drawLive();
    }, sound) : null,
    document.fullscreenEnabled ? iconBtn("⛶", "Vollbild (Anzeigetafel)", function () {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      else dlg.requestFullscreen().catch(function () {});
    }) : null,
  ]);
  const kids = [];
  if (!m.events.length) {
    kids.push(el("div", { class: "zl-banner" }, [el("b", { text: "Gleich geht's los" }), el("span", { text: m.players[m.starter] + " beginnt" })]));
  }
  kids.push(el("div", { class: "zl-board" }, [0, 1].map(function (i) { return playerPanel(m, s, sum, i, !s.done); })));
  if (s.done) {
    kids.push(el("div", { class: "zl-banner" }, [
      el("b", { text: m.players[s.winner] + " gewinnt " + Math.max(s.legs[0], s.legs[1]) + ":" + Math.min(s.legs[0], s.legs[1]) }),
      el("span", { text: "Das Ergebnis erscheint im Turnierbaum, sobald es gespeichert ist." }),
    ]));
  } else if (m.events.length && s.lastLeg && s.rest[0] === m.format.start && s.rest[1] === m.format.start) {
    kids.push(el("div", { class: "zl-banner" }, [
      el("b", { text: "Leg an " + m.players[s.lastLeg.winner] }),
      el("span", { text: s.lastLeg.checkout + " Checkout · " + s.lastLeg.darts + " Darts · " + s.legs[0] + ":" + s.legs[1] }),
    ]));
  }
  if (s.legList.length) {
    kids.push(el("div", { class: "zl-legs" }, s.legList.map(function (leg, k) {
      return el("div", { class: "zl-leg" }, [
        el("span", { class: "zl-leg-nr", text: "Leg " + (k + 1) }),
        el("b", { text: m.players[leg.winner] }),
        el("span", { text: leg.darts + " Darts" }),
        el("span", { text: "Checkout " + leg.checkout }),
      ]);
    })));
  }
  dlg.appendChild(bar);
  dlg.appendChild(el("div", { class: "zl-body live-body" }, [el("div", { class: "zl-play" }, kids)]));
}
