// =====================================================================
//  Ergebnis des Zählers in den Spieltag schreiben
//
//  Immer:              Legs, Sieger, Missed Doubles (Checkout-Quote),
//                      100+ und 140+ (t100, t140), High Finish und 180er (Bonuswerte)
//  Nur im Ligamodus    Average, First-9-Average (f9) und kürzestes Leg
//  (501 Double Out):   (bei Spezial-Modi nicht vergleichbar)
// =====================================================================
import { clean } from "../kern/hilfen.js";
import { cleanupDay } from "../auswertung/spieltag.js";
import { replay, summary, isStandard } from "./spiel.js";

// Hat das Spiel im Spieltag schon ein Ergebnis?
export function hasResult(day, matchId) {
  return !!((day.ergebnisse && day.ergebnisse[matchId]) || (day.sieger && clean(day.sieger[matchId])));
}

// Ergebnis: null (ok) oder Fehlertext
export function applyToDay(day, matchId, m) {
  const s = replay(m);
  if (!s.done) return "Das Spiel ist noch nicht zu Ende.";
  if (hasResult(day, matchId)) return "Dieses Spiel hat schon ein Ergebnis. Lösch es zuerst im Turnierbaum, dann kannst du übernehmen.";
  const players = (day.spieler || []).map(clean);
  if (m.players.some(function (n) { return players.indexOf(n) < 0; })) return "Die Spieler passen nicht mehr zu diesem Spieltag.";

  const standard = isStandard(m.format);
  const sum = summary(m);
  const res = {};
  sum.forEach(function (p) { res[p.name] = p.legs; });
  day.ergebnisse = day.ergebnisse || {};
  day.sieger = day.sieger || {};
  day.ergebnisse[matchId] = res;
  day.sieger[matchId] = m.players[s.winner];

  // Average und Missed Doubles je Spieler in diesem Spiel
  const stats = {};
  sum.forEach(function (p) {
    const st = {};
    if (standard && p.avg !== null) st.avg = Math.round(p.avg * 100) / 100;
    if (m.format.aus !== "single") st.miss = p.miss;
    if (standard && p.f9 !== null) st.f9 = Math.round(p.f9 * 100) / 100;
    st.t100 = p.t100;
    st.t140 = p.t140;
    if (Object.keys(st).length) stats[p.name] = st;
  });
  if (Object.keys(stats).length) {
    day.statistik = day.statistik || {};
    day.statistik[matchId] = stats;
  }

  // Bonuswerte des Spieltags: Bestwerte behalten, 180er dazuzählen
  sum.forEach(function (p) {
    const b = {};
    if (p.hiCo !== null) b.co = p.hiCo;
    if (standard && p.bestLeg !== null) b.leg = p.bestLeg;
    if (p.n180) b.n180 = p.n180;
    if (!Object.keys(b).length) return;
    day.bonus = day.bonus || {};
    const cur = day.bonus[p.name] = day.bonus[p.name] || {};
    if (b.co !== undefined && !(Number(cur.co) >= b.co)) cur.co = b.co;
    if (b.leg !== undefined && !(Number(cur.leg) > 0 && Number(cur.leg) <= b.leg)) cur.leg = b.leg;
    if (b.n180) cur.n180 = (Number(cur.n180) || 0) + b.n180;
  });

  cleanupDay(day);
  return null;
}

// Ergebnis als Text zum Kopieren, z. B. für jemanden mit Bearbeiten-Zugang
export function resultText(label, m) {
  const s = replay(m);
  const sum = summary(m);
  const standard = isStandard(m.format);
  const lines = [label + ": " + sum[0].name + " " + sum[0].legs + ":" + sum[1].legs + " " + sum[1].name];
  sum.forEach(function (p) {
    const parts = [];
    if (standard && p.avg !== null) parts.push("Ø " + p.avg.toFixed(2).replace(".", ","));
    if (standard && p.f9 !== null) parts.push("First 9 " + p.f9.toFixed(2).replace(".", ","));
    if (p.t100 || p.t140) parts.push(p.t100 + "× 100+, " + p.t140 + "× 140+");
    if (m.format.aus !== "single") parts.push("Missed " + p.miss);
    if (p.hiCo !== null) parts.push("High Finish " + p.hiCo);
    if (standard && p.bestLeg !== null) parts.push("kürzestes Leg " + p.bestLeg);
    if (p.n180) parts.push(p.n180 + "× 180");
    lines.push(p.name + ": " + (parts.join(", ") || "–"));
  });
  if (!s.done) lines.push("(Spiel noch nicht beendet)");
  return lines.join("\n");
}
