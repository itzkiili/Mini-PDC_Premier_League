// =====================================================================
//  Caller-Ansagen im Live-Zähler
//  Jede Ansage hat einen Text und (für eigene Aufnahmen) eine Clip-Folge,
//  z. B. „Kilian, you require 81“ = name_kilian + require + n81.
//  Sind alle Clips aufgenommen, wird die Aufnahme abgespielt, sonst spricht
//  die Sprachausgabe des Geräts (Englisch oder Deutsch).
//
//  Die Texte (callsAfterVisit, callsAtStart) sind reine Berechnung und
//  lassen sich ohne Browser testen; speak() spricht sie aus.
// =====================================================================
import { store, load } from "../kern/hilfen.js";
import { minDarts } from "./checkout.js";
import { numberWords, partsScore, partsRequire, partsThrowFirst, partsLeg, partsMatch } from "./clips.js";
import { audioAvailable, anyClips, hasAllClips, playClips, stopClips, preloadClips, loadLocalClips, audioContext } from "./audio.js";

export { numberWords };

const STORE_KEY = "liga.caller";

// ---------------------------------------------------------------------
//  Einstellungen (pro Gerät)
// ---------------------------------------------------------------------
export function callerSettings() {
  let s = null;
  try { s = JSON.parse(load(STORE_KEY) || "null"); } catch (e) { /* egal */ }
  return { on: !!(s && s.on), lang: s && s.lang === "de" ? "de" : "en" };
}

export function saveCallerSettings(s) {
  store(STORE_KEY, JSON.stringify({ on: !!s.on, lang: s.lang }));
}

export function speechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

// Gibt es überhaupt eine Möglichkeit anzusagen?
export function callerAvailable() {
  return speechAvailable() || (audioAvailable() && anyClips());
}

const ORDINAL_EN = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth"];
const ORDINAL_DE = ["erste", "zweite", "dritte", "vierte", "fünfte", "sechste", "siebte", "achte", "neunte", "zehnte",
  "elfte", "zwölfte", "dreizehnte", "vierzehnte", "fünfzehnte", "sechzehnte", "siebzehnte"];

// ---------------------------------------------------------------------
//  Was angesagt wird
//  Ergebnis: Liste von { text, big, parts }
//    big = 180 (langsamer, betont), parts = Clip-Folge für eigene Aufnahmen
// ---------------------------------------------------------------------
function scoreCall(score, bust, lang) {
  const parts = partsScore(score, bust);
  if (bust || score === 0) return { text: lang === "de" ? "Kein Score" : "No score", parts: parts };
  if (score === 180) return { text: lang === "de" ? "Hundertachtzig!" : "One hundred and eighty!", big: true, parts: parts };
  return { text: lang === "de" ? String(score) : capitalize(numberWords(score)), parts: parts };
}

function capitalize(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

function requireCall(name, rest, lang) {
  return { text: lang === "de" ? name + ", noch " + rest : name + ", you require " + numberWords(rest), parts: partsRequire(name, rest) };
}

function throwFirstCall(name, lang, gameOn) {
  const parts = partsThrowFirst(name, gameOn);
  if (lang === "de") return { text: name + " beginnt." + (gameOn ? " Game on!" : ""), parts: parts };
  return { text: name + " to throw first." + (gameOn ? " Game on!" : ""), parts: parts };
}

// Spielbeginn
export function callsAtStart(m, lang) {
  return [throwFirstCall(m.players[m.starter], lang, true)];
}

// Nach einer Aufnahme: before/after = Spielstand vor und nach der Aufnahme (replay)
export function callsAfterVisit(m, before, after, lang) {
  const e = m.events[m.events.length - 1];
  if (!e) return [];
  const calls = [];
  const legWon = after.legList.length > before.legList.length;
  // Beim Checkout sagt der Caller die Punkte nicht an, nur „Game shot“
  if (!legWon) calls.push(scoreCall(e.score, e.bust, lang));

  if (legWon) {
    const leg = after.legList[after.legList.length - 1];
    const name = m.players[leg.winner];
    if (after.done) {
      calls.push({ text: lang === "de" ? "Game shot, und das Match: " + name + "!" : "Game shot, and the match, " + name + "!", parts: partsMatch(name) });
    } else {
      const nr = after.legList.length - 1;
      const ord = lang === "de" ? (ORDINAL_DE[nr] || (nr + 1) + ".") : (ORDINAL_EN[nr] || "leg " + (nr + 1));
      calls.push({ text: lang === "de" ? "Game shot, und das " + ord + " Leg: " + name + "!" : "Game shot, and the " + ord + " leg, " + name + "!",
        parts: partsLeg(nr + 1, name) });
      calls.push(throwFirstCall(m.players[after.turn], lang, false));
    }
    return calls;
  }

  // Nächster Spieler steht auf einem Finish
  const next = after.turn;
  const rest = after.rest[next];
  if (rest <= 170 && minDarts(rest, m.format.aus) !== null) calls.push(requireCall(m.players[next], rest, lang));
  return calls;
}

// ---------------------------------------------------------------------
//  Aussprechen
// ---------------------------------------------------------------------
function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices() || [];
  const want = lang === "de" ? ["de-DE", "de"] : ["en-GB", "en-AU", "en-IE", "en"];
  for (let i = 0; i < want.length; i++) {
    const v = voices.filter(function (x) { return String(x.lang || "").replace("_", "-").indexOf(want[i]) === 0; });
    if (v.length) return v.filter(function (x) { return x.localService; })[0] || v[0];
  }
  return null;
}

let run = 0;   // Nummer der laufenden Ansage-Folge; neue Ansagen brechen ältere ab

function report(detail) {
  try { document.dispatchEvent(new CustomEvent("liga:caller", { detail: detail })); } catch (e) { /* egal */ }
}

// Eine Ansage mit der Sprachausgabe; fertig, wenn gesprochen (oder nach einer Höchstzeit)
function sayText(c, lang) {
  return new Promise(function (resolve) {
    if (!speechAvailable()) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(c.text);
    u.lang = lang === "de" ? "de-DE" : "en-GB";
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = c.big ? 0.75 : 1.05;
    u.pitch = c.big ? 1.15 : 1;
    u.volume = 1;
    let done = false;
    const end = function () { if (!done) { done = true; resolve(); } };
    u.onend = end;
    u.onerror = end;
    setTimeout(end, 1200 + c.text.length * 90);
    report({ type: "tts", text: c.text, lang: u.lang, rate: u.rate });
    window.speechSynthesis.speak(u);
  });
}

// Laufende Ansage abbrechen und die neuen der Reihe nach ansagen:
// eigene Aufnahme, wenn alle Clips da sind, sonst Sprachausgabe
export function speak(calls, lang) {
  if (!calls.length) return;
  silence();
  const me = ++run;
  if (audioAvailable() && anyClips()) audioContext();   // innerhalb der Berührung freischalten
  (async function () {
    for (let i = 0; i < calls.length; i++) {
      if (me !== run) return;
      const c = calls[i];
      if (audioAvailable() && hasAllClips(c.parts)) {
        report({ type: "clips", ids: c.parts.slice(), text: c.text });
        try { await playClips(c.parts); continue; } catch (e) { /* Clip kaputt: Sprachausgabe */ }
      }
      if (me !== run) return;
      await sayText(c, lang);
    }
  })();
}

export function silence() {
  run++;
  stopClips();
  if (speechAvailable()) window.speechSynthesis.cancel();
}

// Manche Geräte laden die Stimmen erst nach einer Weile
// Eigene Aufnahmen vom Gerät laden und vorladen
export function initCaller() {
  if (speechAvailable()) {
    try { window.speechSynthesis.getVoices(); } catch (e) { /* egal */ }
  }
  return loadLocalClips();
}

export function warmUp() { preloadClips(); }
