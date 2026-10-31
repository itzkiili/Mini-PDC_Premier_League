// =====================================================================
//  Tests für die Logik des Live-Zählers (braucht Node.js 18 oder neuer):
//      node werkzeuge/zaehler-test.mjs
// =====================================================================
import { minDarts, checkoutWeg, isPossibleVisit } from "../skripte/zaehler/checkout.js";
import { applyToDay } from "../skripte/zaehler/uebernehmen.js";
import { serialize } from "../skripte/bearbeiten/datei.js";
import { parseDataFile } from "../skripte/kern/daten.js";
import { resolveDay } from "../skripte/auswertung/spieltag.js";
import { computeStandings } from "../skripte/auswertung/tabelle.js";
import { asksDoubles, newMatch, replay, checkVisit, checkoutDoubles, addVisit, undo, summary, isStandard } from "../skripte/zaehler/spiel.js";

let ok = 0;
const fails = [];
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) ok++; else fails.push(name + ": erwartet " + w + ", bekommen " + g);
}

// ---------- Checkouts ----------
eq("170 in 3", minDarts(170, "double"), 3);
eq("169 geht nicht", minDarts(169, "double"), null);
eq("159 geht nicht", minDarts(159, "double"), null);
eq("160 in 3", minDarts(160, "double"), 3);
eq("100 in 2", minDarts(100, "double"), 2);
eq("99 in 3", minDarts(99, "double"), 3);
eq("50 in 1", minDarts(50, "double"), 1);
eq("41 in 2", minDarts(41, "double"), 2);
eq("2 in 1", minDarts(2, "double"), 1);
eq("1 geht nicht", minDarts(1, "double"), null);
eq("Master 180", minDarts(180, "master"), 3);
eq("Master 3", minDarts(3, "master"), 1);
eq("Master 1", minDarts(1, "master"), null);
eq("Single 1", minDarts(1, "single"), 1);
eq("Weg 170", checkoutWeg(170, "double"), ["T20", "T20", "Bull"]);
eq("Weg 100", checkoutWeg(100, "double"), ["T20", "D20"]);
eq("Weg 40", checkoutWeg(40, "double"), ["D20"]);
eq("Weg 32", checkoutWeg(32, "double"), ["D16"]);
eq("179 unmöglich", isPossibleVisit(179), false);
eq("180 möglich", isPossibleVisit(180), true);

// ---------- Ein Spiel: Best of 3, 501 Double Out ----------
const fmt = { start: 501, ein: "single", aus: "double", legsToWin: 2 };
eq("Standard", isStandard(fmt), true);
eq("170 ist kein Standard", isStandard(Object.assign({}, fmt, { start: 170 })), false);
const m = newMatch(["Anna", "Ben"], 0, fmt);

// Leg 1: Anna wirft einen Neun-Darter, Ben dazwischen 60, 60
addVisit(m, 180); addVisit(m, 60); addVisit(m, 180); addVisit(m, 60);
let s = replay(m);
eq("Rest nach 2 Runden", s.rest, [141, 381]);
let c = checkVisit(m, s, 141);
eq("141 ist Checkout", [c.checkout, c.dartOptions, checkoutDoubles(c, 3)], [true, [3], [1]]);
addVisit(m, 141, false, 3, 1);
s = replay(m);
eq("Leg 1 an Anna", s.legs, [1, 0]);
eq("Leg 2 beginnt Ben", [s.legStarter, s.turn], [1, 1]);
eq("Rest zurückgesetzt", s.rest, [501, 501]);

// Leg 2: Ben 100 ×4 = 400, Anna 100 ×4, dann Ben auf 101 -> 61 (Finish möglich, 1 Dart aufs Doppel)
for (let i = 0; i < 4; i++) { addVisit(m, 100); addVisit(m, 100); }
s = replay(m);
eq("Rest Leg 2", s.rest, [101, 101]);
c = checkVisit(m, s, 60);
eq("101 Rest: keine Doppel-Rückfrage (über 50)", [c.bust, c.doubleOptions], [false, null]);
addVisit(m, 60, false, 3, 1);         // Ben: 41 Rest, ein Dart aufs Doppel daneben
s = replay(m);
c = checkVisit(m, s, 100);
eq("Bust bei 1 Rest", c.bust, true);
c = checkVisit(m, s, 102);
eq("Bust über 0", c.bust, true);
addVisit(m, 100, true, 3, 0);         // Anna überworfen
s = replay(m);
eq("Bust zählt nicht", s.rest, [101, 41]);
c = checkVisit(m, s, 41);
eq("41 ist Checkout mit 2 oder 3 Darts", c.dartOptions, [2, 3]);
eq("41 mit dem 3. Dart: 1–2 aufs Doppel", checkoutDoubles(c, 3), [1, 2]);
eq("40 mit dem 3. Dart: 1–3 aufs Doppel", checkoutDoubles(checkVisit(m, Object.assign({}, s, { rest: [40, 40] }), 40), 3), [1, 2, 3]);
c = checkVisit(m, s, 179);
eq("179 abgelehnt", !!c.error, true);
addVisit(m, 41, false, 2, 1);         // Ben checkt mit dem 2. Dart
s = replay(m);
eq("1:1", s.legs, [1, 1]);
eq("Leg 3 beginnt Anna", s.turn, 0);

// Rückgängig
const before = JSON.stringify(replay(m));
addVisit(m, 140);
undo(m);
eq("Rückgängig", JSON.stringify(replay(m)), before);

// Leg 3: Anna 501 in 15 Darts
[180, 0, 140, 0, 100, 0, 41, 0].forEach(function (v) { addVisit(m, v); });
s = replay(m);
eq("Anna auf 40", s.rest[0], 40);
addVisit(m, 40, false, 3, 2);
s = replay(m);
eq("Spiel vorbei", [s.done, s.winner, s.legs], [true, 0, [2, 1]]);
eq("Nach dem Ende keine Eingabe", !!checkVisit(m, s, 60).error, true);

const sum = summary(m);
eq("Anna Darts", sum[0].darts, 9 + 15 + 15);
eq("Anna Punkte/Average", Math.round(sum[0].avg * 100) / 100, Math.round((501 * 2 + 400) / 39 * 3 * 100) / 100);
eq("Anna 180er", sum[0].n180, 3);
eq("Anna High Finish", sum[0].hiCo, 141);
eq("Anna kürzestes Leg", sum[0].bestLeg, 9);
eq("Anna Missed", sum[0].miss, (1 + 0 + 2) - 2);
eq("Ben Legs/Darts", [sum[1].legs, sum[1].darts, sum[1].bestLeg], [1, 6 + 17 + 12, 17]);
eq("Ben Missed", sum[1].miss, 2 - 1);

// ---------- First 9, 100+, 140+ ----------
eq("Anna First 9", Math.round(sum[0].f9 * 100) / 100, Math.round((501 + 300 + 420) / 27 * 3 * 100) / 100);
eq("Ben First 9", sum[1].f9, (120 + 300 + 0) / 24 * 3);
eq("Anna 100+/140+ (141 zählt als 140+, Bust nicht)", [sum[0].t100, sum[0].t140], [5, 2]);
eq("Ben 100+/140+", [sum[1].t100, sum[1].t140], [4, 0]);

// ---------- Doppel-Rückfrage nur bis 50 Rest (Master Out: 60) ----------
eq("Grenze 50", [asksDoubles(50, "double"), asksDoubles(51, "double"), asksDoubles(41, "double"), asksDoubles(1, "double")], [true, false, true, false]);
eq("Master bis 60", [asksDoubles(60, "master"), asksDoubles(61, "master")], [true, false]);
eq("Single Out nie", asksDoubles(20, "single"), false);
{
  const g = newMatch(["A", "B"], 0, { start: 501, ein: "single", aus: "double", legsToWin: 1 });
  const at = function (r) { return Object.assign(replay(g), { rest: [r, r] }); };
  eq("Rest 60, 20 geworfen: keine Frage", checkVisit(g, at(60), 20).doubleOptions, null);
  eq("Rest 40, 20 geworfen: 0–3", checkVisit(g, at(40), 20).doubleOptions, [0, 1, 2, 3]);
  eq("Rest 41, Bust: 0–2 (zwei Darts nötig)", checkVisit(g, at(41), 60).doubleOptions, [0, 1, 2]);
  eq("Checkout 100: ein Dart aufs Doppel", checkoutDoubles(checkVisit(g, at(100), 100), 3), [1]);
  eq("Checkout 40 mit 2. Dart: 1–2", checkoutDoubles(checkVisit(g, at(40), 40), 2), [1, 2]);
}
eq("Legverlauf", replay(m).legList.map(function (l) { return [l.winner, l.starter, l.darts, l.checkout]; }), [[0, 0, 9, 141], [1, 1, 17, 41], [0, 0, 15, 40]]);

// ---------- Übernehmen ----------
function dayWith(extra) {
  return Object.assign({ nr: 1, spieler: ["Anna", "Ben", "Carl", "Dora", "Emil", "Fritz", "Gabi", "Hans"], sieger: {} }, extra || {});
}
let day = dayWith({ bonus: { "Anna": { co: 150, n180: 1 }, "Ben": { leg: 12 } } });
eq("Übernehmen 501", applyToDay(day, "VF1", m), null);
eq("Legs", day.ergebnisse.VF1, { Anna: 2, Ben: 1 });
eq("Sieger", day.sieger.VF1, "Anna");
eq("Statistik", day.statistik.VF1, {
  Anna: { avg: 107.85, miss: 1, f9: 135.67, t100: 5, t140: 2 },
  Ben: { avg: Math.round((120 + 501) / 35 * 3 * 100) / 100, miss: 1, f9: 52.5, t100: 4, t140: 0 },
});
{
  // Speichern und wieder einlesen: neue Felder bleiben erhalten, Tabelle summiert sie
  const text = serialize({ name: "Test" }, [day]);
  const back = parseDataFile(text).tage[0];
  eq("Gespeichert", back.statistik.VF1.Anna, { avg: 107.85, miss: 1, f9: 135.67, t100: 5, t140: 2 });
  const rows = computeStandings([resolveDay(back, [])]).rows;
  const anna = rows.filter(function (r) { return r.name === "Anna"; })[0];
  eq("Summiert", [anna.f9N, anna.f9Sum, anna.t100, anna.t140, anna.tN], [1, 135.67, 5, 2, 1]);
}
eq("Bonus: höheres Finish bleibt, 180er addiert, kürzestes Leg", day.bonus.Anna, { co: 150, n180: 4, leg: 9 });
eq("Bonus: kürzeres Leg bleibt", day.bonus.Ben, { leg: 12, co: 41 });
eq("Zweimal übernehmen geht nicht", typeof applyToDay(day, "VF1", m), "string");

// Spezial-Modus: 170er-Legs, First to 1 – nur Legs, Checkout-Quote, High Finish, 180er
const sp = newMatch(["Anna", "Ben"], 0, { start: 170, ein: "single", aus: "double", legsToWin: 1 });
addVisit(sp, 60); addVisit(sp, 100); addVisit(sp, 110, false, 3, 2);
day = dayWith();
eq("Übernehmen Spezial", applyToDay(day, "VF1", sp), null);
eq("Spezial: Legs", day.ergebnisse.VF1, { Anna: 1, Ben: 0 });
eq("Spezial: kein Average/First 9, aber 100+", day.statistik.VF1, { Anna: { miss: 1, t100: 1, t140: 0 }, Ben: { miss: 0, t100: 1, t140: 0 } });
eq("Spezial: High Finish ja, kürzestes Leg nein", day.bonus, { Anna: { co: 110 } });

if (fails.length) {
  console.log("✗ " + fails.length + " von " + (ok + fails.length) + " Tests fehlgeschlagen:\n  " + fails.join("\n  "));
  process.exit(1);
}
console.log("✓ " + ok + " Tests bestanden.");
