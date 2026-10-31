// =====================================================================
//  Checkouts: was lässt sich mit wie vielen Darts beenden, und wie?
//  Reine Berechnung, ohne Zugriff auf die Seite.
//
//  aus: "double" (Double Out), "master" (Doppel oder Triple) oder "single"
// =====================================================================

// Alle Felder des Boards: { name, wert, art: "S" | "D" | "T" }
const FELDER = [];
for (let n = 1; n <= 20; n++) {
  FELDER.push({ name: String(n), wert: n, art: "S" });
  FELDER.push({ name: "D" + n, wert: 2 * n, art: "D" });
  FELDER.push({ name: "T" + n, wert: 3 * n, art: "T" });
}
FELDER.push({ name: "25", wert: 25, art: "S" });
FELDER.push({ name: "Bull", wert: 50, art: "D" });

// Mit drei Darts nicht erreichbare Aufnahmen
export const UNMOEGLICH = [163, 166, 169, 172, 173, 175, 176, 178, 179];

export function isPossibleVisit(score) {
  return Number.isInteger(score) && score >= 0 && score <= 180 && UNMOEGLICH.indexOf(score) < 0;
}

function finishes(feld, aus) {
  if (aus === "single") return true;
  if (aus === "master") return feld.art === "D" || feld.art === "T";
  return feld.art === "D";
}

// Beliebte Doppel zum Auschecken, in Stufen: erst Stufe 0, dann 1, dann der Rest
const STUFEN = [["D20", "D16", "D8", "D18", "D12", "D10", "Bull"], ["D4", "D14", "D6", "D2"]];

// Bewertung des letzten Darts: [Stufe, Platz in der Stufe]
function finishKey(f) {
  for (let i = 0; i < STUFEN.length; i++) {
    const j = STUFEN[i].indexOf(f.name);
    if (j >= 0) return [i, j];
  }
  if (f.art === "D") return [2, 50 - f.wert];
  return [3, 60 - f.wert];   // Triple oder Single (Master/Single Out): hohe Werte zuerst
}

// Je kleiner, desto lieber als Dart vor dem Finish:
// T20–T15, dann Singles (20 vor 1), dann 25, dann kleine Triple, zuletzt Doppel
function setupRang(f) {
  const n = f.art === "T" ? f.wert / 3 : f.wert;
  if (f.art === "T" && n >= 15) return 20 - n;          // 0–5
  if (f.art === "S" && n <= 20) return 6 + (20 - n);    // 6–25
  if (f.art === "S") return 26;                         // 25
  if (f.art === "T") return 27 + (14 - n);              // 27–40
  return 60 + (50 - f.wert);
}

// Weg A ist besser als Weg B? Reihenfolge: weniger Darts, beliebteres Doppel,
// besserer erster Dart, besserer zweiter Dart, Platz des Doppels
function besser(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// Für jeden Rest von 1 bis 180: bester Weg mit möglichst wenigen Darts
const WEGE = {};

function berechneWege(aus) {
  const best = {};
  const finisher = FELDER.filter(function (f) { return finishes(f, aus); });
  function nimm(darts) {
    const z = darts[darts.length - 1], fk = finishKey(z);
    const setup = darts.slice(0, -1).map(setupRang);
    const key = [darts.length, fk[0], setup[0] || 0, setup[1] || 0, fk[1]];
    const rest = darts.reduce(function (sum, f) { return sum + f.wert; }, 0);
    if (!best[rest] || besser(key, best[rest].key)) best[rest] = { darts: darts.map(function (f) { return f.name; }), key: key };
  }
  finisher.forEach(function (z) { nimm([z]); });
  FELDER.forEach(function (a) { finisher.forEach(function (z) { nimm([a, z]); }); });
  FELDER.forEach(function (a) {
    FELDER.forEach(function (b) {
      if (setupRang(b) < setupRang(a)) return;   // gleiche Wege nur einmal, besserer Dart zuerst
      finisher.forEach(function (z) { nimm([a, b, z]); });
    });
  });
  return best;
}

function wegeFuer(aus) {
  if (!WEGE[aus]) WEGE[aus] = berechneWege(aus);
  return WEGE[aus];
}

// Wie viele Darts braucht man mindestens für `rest`? null = mit drei Darts nicht möglich
export function minDarts(rest, aus) {
  const w = wegeFuer(aus)[rest];
  return w ? w.darts.length : null;
}

// Vorschlag zum Auschecken, z. B. ["T20", "T20", "Bull"], oder null
export function checkoutWeg(rest, aus) {
  const w = wegeFuer(aus)[rest];
  return w ? w.darts.slice() : null;
}
