// =====================================================================
//  Ein Spiel im Live-Zähler
//  Das Spiel ist nur eine Liste von Aufnahmen (events). Der Spielstand
//  wird daraus jedes Mal neu berechnet (replay). Rückgängig = letzte
//  Aufnahme entfernen. So kann nichts aus dem Tritt geraten.
//  Reine Berechnung, ohne Zugriff auf die Seite.
//
//  Eine Aufnahme: { score, bust, darts, doubles }
//    score    eingetippte Punkte (bei Bust die geworfenen, zählen nicht)
//    bust     überworfen
//    darts    geworfene Darts (3, beim Checkout 1–3)
//    doubles  Darts aufs Doppel (bzw. aufs Finish bei Master Out)
// =====================================================================
import { isPossibleVisit, minDarts } from "./checkout.js";

// Höchster Rest, den man mit einem Dart auschecken kann (Double Out: Bull)
export const DOPPEL_GRENZE = { double: 50, master: 60 };

function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

// ---------------------------------------------------------------------
//  Darts aufs Doppel: nur fragen, wenn in dieser Aufnahme ein Versuch
//  möglich war. Ergebnis: mögliche Anzahl (z. B. [0, 1, 2]) oder null.
//    - Rest vorher ≤ 50 (Master Out: 60): man stand schon auf einem Doppel
//    - Rest nachher ≤ 50: z. B. 60 → erst 20, dann zwei Darts auf D20
//    - Bust aus einem Rest, der mit zwei Darts zu checken ist
//  Wie viele es höchstens sein können, hängt davon ab, wie viele Darts man
//  mindestens bis zum Doppel braucht (60: einer → bis zu 2 aufs Doppel).
// ---------------------------------------------------------------------
export function doubleOptionsFor(rest, after, bust, aus) {
  if (aus === "single") return null;
  const needed = minDarts(rest, aus);
  if (needed === null) return null;
  const grenze = DOPPEL_GRENZE[aus];
  const possible = rest <= grenze || (bust ? needed <= 2 : after <= grenze);
  return possible ? range(0, 4 - needed) : null;
}

// Für Bust-Knopf: Darts aufs Doppel beim aktuellen Spieler
export function bustDoubles(m, s) {
  return doubleOptionsFor(s.rest[s.turn], null, true, m.format.aus);
}

// format: { start, ein, aus, legsToWin }; starter: 0 oder 1 (wer das erste Leg beginnt)
export function newMatch(players, starter, format) {
  return { v: 1, players: players.slice(0, 2), starter: starter, format: Object.assign({}, format), events: [] };
}

// Normaler Ligamodus? Nur dann zählen Average, High Finish, kürzestes Leg und 180er.
export function isStandard(format) {
  return format.start === 501 && format.ein === "single" && format.aus === "double";
}

function emptyStats() {
  return { points: 0, darts: 0, n180: 0, t100: 0, t140: 0, f9Points: 0, f9Darts: 0,
    hiCo: null, bestLeg: null, doubles: 0, checkouts: 0, visits: [] };
}

// Aufnahmen zählen: 100+ = 100–139, 140+ = 140–179, 180 extra (wie im Fernsehen)
export function visitClass(score) {
  if (score === 180) return "t180";
  if (score >= 140) return "t140";
  if (score >= 100) return "t100";
  return null;
}

// ---------------------------------------------------------------------
//  Spielstand aus den Aufnahmen berechnen
// ---------------------------------------------------------------------
export function replay(m) {
  const f = m.format;
  const s = {
    legs: [0, 0], leg: 0, legStarter: m.starter, turn: m.starter,
    rest: [f.start, f.start], legDarts: [0, 0],
    stats: [emptyStats(), emptyStats()],
    done: false, winner: null, lastLeg: null,
    legList: [],   // gespielte Legs: { winner, starter, darts, checkout }
  };
  m.events.forEach(function (e) {
    const p = s.turn;
    const st = s.stats[p];
    // First 9: Punkte und Darts der ersten neun Darts jedes Legs
    const before = s.legDarts[p];
    if (before < 9) {
      st.f9Darts += Math.min(e.darts, 9 - before);
      if (!e.bust) st.f9Points += e.score;
    }
    st.darts += e.darts;
    s.legDarts[p] += e.darts;
    st.doubles += e.doubles || 0;
    if (!e.bust) {
      st.points += e.score;
      s.rest[p] -= e.score;
      const cls = visitClass(e.score);
      if (cls === "t180") st.n180++;
      else if (cls) st[cls]++;
    }
    st.visits.push(e.bust ? "Bust" : String(e.score));
    if (!e.bust && s.rest[p] === 0) {
      // Leg gewonnen
      st.checkouts++;
      if (st.hiCo === null || e.score > st.hiCo) st.hiCo = e.score;
      if (st.bestLeg === null || s.legDarts[p] < st.bestLeg) st.bestLeg = s.legDarts[p];
      s.legs[p]++;
      s.lastLeg = { winner: p, starter: s.legStarter, darts: s.legDarts[p], checkout: e.score };
      s.legList.push(s.lastLeg);
      if (s.legs[p] >= f.legsToWin) { s.done = true; s.winner = p; return; }
      s.leg++;
      s.legStarter = s.leg % 2 === 0 ? m.starter : 1 - m.starter;   // Anwurf wechselt jedes Leg
      s.turn = s.legStarter;
      s.rest = [f.start, f.start];
      s.legDarts = [0, 0];
      s.stats[0].visits = []; s.stats[1].visits = [];
      return;
    }
    s.turn = 1 - p;
  });
  return s;
}

// ---------------------------------------------------------------------
//  Eingetippte Aufnahme prüfen, bevor sie gespeichert wird
//  Ergebnis: { error } oder { bust, checkout, dartOptions, doubleOptions }
//    dartOptions    mögliche Anzahl Darts beim Checkout (null = immer 3)
//    doubleOptions  mögliche Darts aufs Doppel (null = keine Rückfrage)
// ---------------------------------------------------------------------
export function checkVisit(m, s, score) {
  if (s.done) return { error: "Das Spiel ist schon vorbei." };
  if (!isPossibleVisit(score)) return { error: score > 180 ? "Mehr als 180 geht nicht." : score + " kann man mit drei Darts nicht werfen." };
  const aus = m.format.aus;
  const rest = s.rest[s.turn];
  const needed = minDarts(rest, aus);   // null = mit dieser Aufnahme nicht auscheckbar
  const after = rest - score;

  if (after === 0) {
    if (needed === null) return { error: rest + " kann man nicht auschecken" + (aus === "double" ? " (Double Out)." : ".") };
    return { bust: false, checkout: true, needed: needed, single: aus === "single",
      dartOptions: range(needed, 3), doubleOptions: null };
  }
  const bust = after < 0 || (after === 1 && aus !== "single");
  return { bust: bust, checkout: false, dartOptions: null, doubleOptions: doubleOptionsFor(rest, after, bust, aus) };
}

// Beim Checkout mit `darts` Darts: mögliche Darts aufs Doppel (null = keine Rückfrage)
// Wer z. B. 40 mit dem 3. Dart checkt, kann 1 bis 3 Darts aufs Doppel geworfen haben;
// bei 60 oder 100 (zwei Darts nötig) mit dem 3. Dart 1 oder 2, mit dem 2. Dart genau 1.
// Nur eine Möglichkeit: wird ohne Rückfrage übernommen.
export function checkoutDoubles(c, darts) {
  if (c.single) return null;
  return range(1, darts - c.needed + 1);
}

// Aufnahme speichern; darts = Anzahl Darts beim Checkout, sonst 3
export function addVisit(m, score, bust, darts, doubles) {
  m.events.push({ score: score, bust: !!bust, darts: darts || 3, doubles: doubles || 0 });
}

export function undo(m) {
  return m.events.pop() || null;
}

// ---------------------------------------------------------------------
//  Zusammenfassung je Spieler
// ---------------------------------------------------------------------
export function summary(m) {
  const s = replay(m);
  return s.stats.map(function (st, i) {
    return {
      name: m.players[i],
      legs: s.legs[i],
      avg: st.darts ? st.points / st.darts * 3 : null,
      f9: st.f9Darts ? st.f9Points / st.f9Darts * 3 : null,
      t100: st.t100,
      t140: st.t140,
      darts: st.darts,
      n180: st.n180,
      hiCo: st.hiCo,
      bestLeg: st.bestLeg,
      doubles: st.doubles,
      checkouts: st.checkouts,
      miss: Math.max(0, st.doubles - st.checkouts),
    };
  });
}
