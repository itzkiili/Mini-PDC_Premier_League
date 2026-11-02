// =====================================================================
//  Caller-Clips: welche Aufnahmen es gibt und woraus sich eine Ansage
//  zusammensetzt. Reine Berechnung, ohne Zugriff auf die Seite.
//
//  Kürzel:
//    n1 … n180          Zahlen (nur Werte, die man mit drei Darts werfen kann)
//    gameon, throwfirst, require, noscore, gs_match, gs_leg1 … gs_leg9
//    name_<slug>        Spielernamen, z. B. name_kilian
// =====================================================================
import { isPossibleVisit } from "./checkout.js";

export const MAX_LEG_CLIPS = 9;

// Name -> Teil des Dateinamens: "Jörg Müller" -> "joerg-mueller"
export function slug(name) {
  return String(name).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "spieler";
}

export function nameClip(name) { return "name_" + slug(name); }
export function numberClip(n) { return "n" + n; }
export function legClip(nr) { return nr <= MAX_LEG_CLIPS ? "gs_leg" + nr : null; }

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

// Zahlen in Worten, britisch: „one hundred and forty“
export function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + numberWords(n % 100) : "");
  return String(n);
}

function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

// ---------------------------------------------------------------------
//  Alle Clips zum Aufnehmen: { id, group, text, hint }
//  names: Spielernamen, für die ein Namens-Clip gebraucht wird
// ---------------------------------------------------------------------
export function clipCatalog(names) {
  const list = [
    { id: "gameon", group: "Sätze", text: "Game on!", hint: "Zum Spielbeginn, mit Schwung" },
    { id: "throwfirst", group: "Sätze", text: "… to throw first", hint: "Folgt auf einen Namen: „Kilian … to throw first“" },
    { id: "require", group: "Sätze", text: "… you require …", hint: "Zwischen Name und Zahl: „Kilian … you require … 81“" },
    { id: "noscore", group: "Sätze", text: "No score", hint: "Bei 0 Punkten oder Bust" },
    { id: "gs_match", group: "Sätze", text: "Game shot, and the match …", hint: "Danach kommt der Name des Siegers" },
  ];
  for (let i = 1; i <= MAX_LEG_CLIPS; i++) {
    list.push({ id: "gs_leg" + i, group: "Sätze", text: "Game shot, and the " + ORDINAL[i - 1] + " leg …", hint: "Danach kommt der Name" });
  }
  names.slice().sort(function (a, b) { return a.localeCompare(b, "de"); }).forEach(function (n) {
    list.push({ id: nameClip(n), group: "Namen", text: n, hint: "Wie beim Walk-on" });
  });
  // 180 zuerst, dann die häufigsten Aufnahmen, dann der Rest
  const common = [180, 140, 100, 60, 45, 41, 26, 85, 81, 121, 0];
  const nums = [];
  common.forEach(function (n) { if (n > 0) nums.push(n); });
  for (let n = 1; n <= 180; n++) if (isPossibleVisit(n) && nums.indexOf(n) < 0) nums.push(n);
  nums.forEach(function (n) {
    list.push({ id: numberClip(n), group: "Zahlen", text: n === 180 ? "One hundred and eighty!" : cap(numberWords(n)),
      hint: n === 180 ? "Mit voller Energie, schön langgezogen" : String(n) });
  });
  return list;
}

// ---------------------------------------------------------------------
//  Ansagen als Clip-Folgen (für die Aufnahmen)
// ---------------------------------------------------------------------
export function partsScore(score, bust) {
  return bust || score === 0 ? ["noscore"] : [numberClip(score)];
}
export function partsRequire(name, rest) { return [nameClip(name), "require", numberClip(rest)]; }
export function partsThrowFirst(name, gameOn) {
  return gameOn ? [nameClip(name), "throwfirst", "gameon"] : [nameClip(name), "throwfirst"];
}
export function partsLeg(nr, name) {
  const c = legClip(nr);
  return c ? [c, nameClip(name)] : null;
}
export function partsMatch(name) { return ["gs_match", nameClip(name)]; }
