// =====================================================================
//  Datendateien lesen
//  daten/*.js werden in index.html als normale <script> geladen und legen
//  LIGA, SPIELTAGE, SAISONS, SPIELER und ZUGANG an. Nur diese Datei greift
//  direkt darauf zu.
// =====================================================================
/* global LIGA, SPIELTAGE, SAISONS, SPIELER, ZUGANG */

export const geladen = {
  liga: typeof LIGA !== "undefined" && LIGA ? LIGA : null,
  tage: typeof SPIELTAGE !== "undefined" ? SPIELTAGE : undefined,
  saisons: typeof SAISONS !== "undefined" && Array.isArray(SAISONS) ? SAISONS : [],
  spieler: typeof SPIELER !== "undefined" && SPIELER ? SPIELER : {},
  zugang: typeof ZUGANG !== "undefined" ? ZUGANG : null,
};

// Text einer Datei im Format von ergebnisse.js auswerten (GitHub, Archiv)
export function parseDataFile(text) {
  const f = new Function(text + "\n;return { liga: (typeof LIGA !== 'undefined' ? LIGA : null), tage: (typeof SPIELTAGE !== 'undefined' ? SPIELTAGE : null) };");
  return f();
}

// Text von spieler.js auswerten
export function parseProfilesFile(text) {
  const f = new Function(text + "\n;return (typeof SPIELER !== 'undefined' ? SPIELER : {});");
  return f() || {};
}
