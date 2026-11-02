// =====================================================================
//  Caller-Ansagen im Live-Zähler
//  Nutzt die Sprachausgabe des Geräts (Web Speech API): kostenlos, offline,
//  keine Dateien. Englisch wie im Fernsehen oder Deutsch.
//
//  Die Texte (callsAfterVisit, callsAtStart) sind reine Berechnung und
//  lassen sich ohne Browser testen; speak() spricht sie aus.
// =====================================================================
import { store, load } from "../kern/hilfen.js";
import { minDarts } from "./checkout.js";

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

// ---------------------------------------------------------------------
//  Zahlen in Worten (britisch: „one hundred and forty“)
//  Deutsch übernimmt die Sprachausgabe selbst (Ziffern werden richtig gelesen).
// ---------------------------------------------------------------------
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + numberWords(n % 100) : "");
  return String(n);
}

const ORDINAL_EN = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth"];
const ORDINAL_DE = ["erste", "zweite", "dritte", "vierte", "fünfte", "sechste", "siebte", "achte", "neunte", "zehnte",
  "elfte", "zwölfte", "dreizehnte", "vierzehnte", "fünfzehnte", "sechzehnte", "siebzehnte"];

// ---------------------------------------------------------------------
//  Was angesagt wird
//  Ergebnis: Liste von { text, big } – big = 180 (langsamer, betont)
// ---------------------------------------------------------------------
function scoreCall(score, bust, lang) {
  if (bust || score === 0) return { text: lang === "de" ? "Kein Score" : "No score" };
  if (score === 180) return { text: lang === "de" ? "Hundertachtzig!" : "One hundred and eighty!", big: true };
  return { text: lang === "de" ? String(score) : capitalize(numberWords(score)) };
}

function capitalize(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

function requireCall(name, rest, lang) {
  return { text: lang === "de" ? name + ", noch " + rest : name + ", you require " + numberWords(rest) };
}

function throwFirstCall(name, lang, gameOn) {
  if (lang === "de") return { text: name + " beginnt." + (gameOn ? " Game on!" : "") };
  return { text: name + " to throw first." + (gameOn ? " Game on!" : "") };
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
      calls.push({ text: lang === "de" ? "Game shot, und das Match: " + name + "!" : "Game shot, and the match, " + name + "!" });
    } else {
      const nr = after.legList.length - 1;
      const ord = lang === "de" ? (ORDINAL_DE[nr] || (nr + 1) + ".") : (ORDINAL_EN[nr] || "leg " + (nr + 1));
      calls.push({ text: lang === "de" ? "Game shot, und das " + ord + " Leg: " + name + "!" : "Game shot, and the " + ord + " leg, " + name + "!" });
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

// Laufende Ansage abbrechen und die neuen der Reihe nach sprechen
export function speak(calls, lang) {
  if (!speechAvailable() || !calls.length) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = pickVoice(lang);
  calls.forEach(function (c) {
    const u = new SpeechSynthesisUtterance(c.text);
    u.lang = lang === "de" ? "de-DE" : "en-GB";
    if (voice) u.voice = voice;
    u.rate = c.big ? 0.75 : 1.05;
    u.pitch = c.big ? 1.15 : 1;
    u.volume = 1;
    synth.speak(u);
  });
}

export function silence() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

// Manche Geräte laden die Stimmen erst nach einer Weile
export function initCaller() {
  if (speechAvailable()) {
    try { window.speechSynthesis.getVoices(); } catch (e) { /* egal */ }
  }
}
