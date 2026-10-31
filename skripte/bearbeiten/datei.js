// =====================================================================
//  ergebnisse.js erzeugen
//  Gleiches Format für die laufende Saison und für archivierte Saisons.
//  Das Format nicht ändern: alte Archive und das Bearbeiten von Hand
//  verlassen sich darauf.
// =====================================================================
import { KEY_ORDER } from "../kern/konstanten.js";
import { clean, toNum } from "../kern/hilfen.js";
import { punkte, bonusCfg } from "../kern/zustand.js";
import { cleanModus, MODUS_FELDER } from "../auswertung/modus.js";

const HEADER = [
  "// =====================================================================",
  "//  ERGEBNISSE",
  "// =====================================================================",
  "//",
  "//  Diese Datei kannst du auf der Seite über „Ergebnisse bearbeiten“",
  "//  ändern oder weiterhin hier von Hand bearbeiten.",
  "//",
  "//  Spielmodus (optional, bei LIGA für die Saison oder bei einem Spieltag):",
  "//  - modus: { start: 501, ein: \"single\", aus: \"double\", legs: 2, legsFinale: 3 }",
  "//        start: Startpunkte   ein: \"double\" = Double In",
  "//        aus: \"double\", \"master\" (Doppel oder Triple) oder \"single\"",
  "//        legs: Gewinnlegs (2 = Best of 3)   legsFinale: Gewinnlegs im Finale",
  "//        legsPlus: zusätzliche Gewinnlegs an einem Spieltag (170er-Legs: 1)",
  "//",
  "//  Aufbau eines Spieltags:",
  "//  - spieler: bis zu 8 Namen in der Reihenfolge A bis H, freie Plätze = null",
  "//        VF1: A gegen B   VF2: C gegen D   VF3: E gegen F   VF4: G gegen H",
  "//  - sieger:  Name des Siegers je Spiel; noch nicht gespielte Spiele weglassen",
  "//        7–8 Spieler: VF1–VF4, PR1, PR2, HF1, HF2, P7, P5, P3, Finale",
  "//        5–6 Spieler: VF1–VF3, Gewinnergruppe G1–G3, Verlierergruppe V1–V3",
  "//          G1: Sieger VF1 – VF2   G2: Sieger VF2 – VF3   G3: Sieger VF1 – VF3",
  "//          (V1–V3 genauso mit den Verlierern)",
  "//  - ergebnisse: Legs je Spiel, z. B. VF1: { \"Anna\": 3, \"Ben\": 1 }",
  "//        (optional; der Sieger ergibt sich dann aus den Legs)",
  "//  - bonus: optional je Spieler und Spieltag: höchstes Checkout (co),",
  "//        kürzestes Leg in Darts (leg) und Anzahl 180er (n180),",
  "//        z. B. bonus: { \"Anna\": { co: 121, n180: 2 }, \"Ben\": { leg: 15 } }",
  "//  - statistik: optional je Spiel und Spieler Average (avg) und Missed",
  "//        Doubles (miss), z. B. VF1: { \"Anna\": { avg: 54.3, miss: 4 } }",
  "//        vom Live-Zähler zusätzlich: First-9-Average (f9) und Anzahl der",
  "//        Aufnahmen 100–139 (t100) und 140–179 (t140)",
  "//        Checkout-Quote = gewonnene Legs / (gewonnene Legs + Missed Doubles)",
  "//  - stechen: nur bei Gleichstand in einer Dreiergruppe, Reihenfolge ab Platz 1",
  "//",
  "//  Namen immer genau gleich schreiben (z. B. immer \"Max\", nie \"max\").",
  "// =====================================================================",
  "",
].join("\n");

// Name als Text in Anführungszeichen, leer = null
function q(v) { return v === null || v === undefined || String(v).trim() === "" ? "null" : JSON.stringify(String(v).trim()); }

// Spielmodus als eine Zeile: { start: 170, legsPlus: 1 } (oder null)
function modusValue(raw) {
  const m = cleanModus(raw);
  if (!m) return null;
  return "{ " + MODUS_FELDER.filter(function (k) { return k in m; })
    .map(function (k) { return k + ": " + JSON.stringify(m[k]); }).join(", ") + " }";
}

// Schlüssel ohne Anführungszeichen, wenn möglich (VF1: …)
function key(k) { return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k); }

export function serialize(liga, days) {
  const out = [HEADER];
  out.push.apply(out, ligaLines(liga, days));
  out.push("");
  out.push("const SPIELTAGE = [");
  days.forEach(function (day) { out.push.apply(out, dayLines(day)); });
  out.push("];");
  out.push("");
  return out.join("\n");
}

// ---------- const LIGA = { … } ----------
function ligaLines(liga, days) {
  const out = [];
  out.push("const LIGA = {");
  out.push("  name: " + JSON.stringify(liga.name || "Liga") + ",");
  out.push("  // Punkte für Platz 1 bis 8 bei 7–8 Spielern");
  out.push("  punkte: [" + punkte(null, liga).map(Number).join(", ") + "],");
  if (Array.isArray(liga.punkteKlein)) {
    out.push("  // Punkte für Platz 1 bis 6 bei 5–6 Spielern");
    out.push("  punkteKlein: [" + liga.punkteKlein.map(Number).join(", ") + "],");
  }
  const bc = bonusCfg(liga);
  out.push("  // Bonuspunkte: höchstes Checkout und kürzestes Leg je Spieltag, jede 180");
  out.push("  bonus: { checkout: " + bc.checkout + ", leg: " + bc.leg + ", je180: " + bc.je180 + " },");
  const modus = modusValue(liga.modus);
  if (modus) {
    out.push("  // Spielmodus der Saison (siehe oben); fehlt er, gilt 501 Double Out, Best of 3, Finale Best of 5");
    out.push("  modus: " + modus + ",");
  }
  const ts = (Array.isArray(liga.stechen) ? liga.stechen : []).map(clean).filter(Boolean);
  if (ts.length) {
    out.push("  // Entscheidungsleg/Stechen bei Gleichstand in der Gesamttabelle (bessere zuerst)");
    out.push("  stechen: [" + ts.map(q).join(", ") + "],");
  }
  const aktuellExists = liga.aktuell != null && days.some(function (d) { return Number(d.nr) === Number(liga.aktuell); });
  if (aktuellExists) {
    out.push("  // Dieser Spieltag wird beim Öffnen der Seite angezeigt (weglassen = neuester)");
    out.push("  aktuell: " + Number(liga.aktuell) + ",");
  }
  if (liga.stand) {
    out.push("  // Zeitpunkt der letzten Speicherung (wird automatisch gesetzt)");
    out.push("  stand: " + JSON.stringify(String(liga.stand)) + ",");
  }
  out.push("};");
  return out;
}

// ---------- ein Spieltag { nr, datum, spieler, sieger, … } ----------
function dayLines(day) {
  const out = [];
  const players = (Array.isArray(day.spieler) ? day.spieler.slice(0, 8) : []).map(clean);
  while (players.length && players[players.length - 1] === null) players.pop();
  out.push("  {");
  out.push("    nr: " + (Number(day.nr) || 0) + ",");
  out.push("    datum: " + JSON.stringify(day.datum || "") + ",");
  const modus = modusValue(day.modus);
  if (modus) out.push("    modus: " + modus + ",");
  out.push("    spieler: [" + players.map(q).join(", ") + "],");

  // sieger (immer vorhanden, ggf. leer)
  const s = day.sieger || {};
  const keys = KEY_ORDER.filter(function (k) { return clean(s[k]); })
    .concat(Object.keys(s).filter(function (k) { return KEY_ORDER.indexOf(k) < 0 && clean(s[k]); }));
  if (keys.length) {
    out.push("    sieger: {");
    keys.forEach(function (k) { out.push("      " + key(k) + ": " + q(s[k]) + ","); });
    out.push("    },");
  } else {
    out.push("    sieger: {},");
  }

  // ergebnisse: VF1: { "Anna": 2, "Ben": 1 }
  const eg = day.ergebnisse || {};
  block(out, "ergebnisse", KEY_ORDER.filter(function (k) {
    return eg[k] && typeof eg[k] === "object" && Object.keys(eg[k]).length === 2;
  }).map(function (k) {
    const pair = Object.keys(eg[k]).map(function (n) { return q(n) + ": " + (Number(eg[k][n]) || 0); }).join(", ");
    return k + ": { " + pair + " },";
  }));

  // bonus: "Anna": { co: 121, n180: 2 }
  const bo = day.bonus || {};
  const boNames = Object.keys(bo).filter(function (n) { return bo[n] && Object.keys(bo[n]).length; });
  block(out, "bonus", boNames.map(function (n) {
    const f = [];
    ["co", "leg", "n180"].forEach(function (k) { if (bo[n][k] != null && bo[n][k] !== "") f.push(k + ": " + Number(bo[n][k])); });
    return f.length ? q(n) + ": { " + f.join(", ") + " }," : null;
  }), boNames.length > 0);

  // statistik: VF1: { "Anna": { avg: 54.3, miss: 4, f9: 61.2, t100: 3, t140: 1 } }
  const sxAll = day.statistik || {};
  const sxKeys = KEY_ORDER.filter(function (k) { return sxAll[k] && typeof sxAll[k] === "object" && Object.keys(sxAll[k]).length; });
  block(out, "statistik", sxKeys.map(function (k) {
    const parts = Object.keys(sxAll[k]).map(function (n) {
      const ps = sxAll[k][n] || {};
      const f = [];
      ["avg", "miss", "f9", "t100", "t140"].forEach(function (k) {
        if (toNum(ps[k]) !== null) f.push(k + ": " + toNum(ps[k]));
      });
      return f.length ? q(n) + ": { " + f.join(", ") + " }" : null;
    }).filter(Boolean);
    return parts.length ? k + ": { " + parts.join(", ") + " }," : null;
  }), sxKeys.length > 0);

  // stechen: G: ["Anna", "Ben", "Carl"]
  const st = day.stechen || {};
  block(out, "stechen", Object.keys(st).filter(function (k) {
    return Array.isArray(st[k]) && st[k].map(clean).filter(Boolean).length;
  }).map(function (k) {
    return k + ": [" + st[k].map(clean).filter(Boolean).map(q).join(", ") + "],";
  }));

  out.push("  },");
  return out;
}

// Eingerückter Block „name: { … },“; leere Zeilen (null) werden ausgelassen.
// show: Block auch dann schreiben, wenn alle Zeilen leer sind (wie bisher)
function block(out, name, lines, show) {
  if (show === undefined) show = lines.length > 0;
  if (!show) return;
  out.push("    " + name + ": {");
  lines.forEach(function (l) { if (l) out.push("      " + l); });
  out.push("    },");
}
