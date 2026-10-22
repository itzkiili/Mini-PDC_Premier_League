// =====================================================================
//  ERGEBNISSE
// =====================================================================
//
//  Diese Datei kannst du auf der Seite über „Ergebnisse bearbeiten“
//  ändern oder weiterhin hier von Hand bearbeiten.
//
//  Aufbau eines Spieltags:
//  - spieler: bis zu 8 Namen in der Reihenfolge A bis H, freie Plätze = null
//        VF1: A gegen B   VF2: C gegen D   VF3: E gegen F   VF4: G gegen H
//  - sieger:  Name des Siegers je Spiel; noch nicht gespielte Spiele weglassen
//        7–8 Spieler: VF1–VF4, PR1, PR2, HF1, HF2, P7, P5, P3, Finale
//        5–6 Spieler: VF1–VF3, Gewinnergruppe G1–G3, Verlierergruppe V1–V3
//          G1: Sieger VF1 – VF2   G2: Sieger VF2 – VF3   G3: Sieger VF1 – VF3
//          (V1–V3 genauso mit den Verlierern)
//  - stechen: nur bei Gleichstand in einer Dreiergruppe, Reihenfolge ab Platz 1
//
//  Namen immer genau gleich schreiben (z. B. immer "Max", nie "max").
// =====================================================================

const LIGA = {
  name: "Liga 2026/27",
  // Punkte für Platz 1 bis 8 an jedem Spieltag
  punkte: [15, 12, 10, 8, 7, 6, 5, 4],
};

const SPIELTAGE = [
  {
    nr: 1,
    datum: "19.10.2026",
    spieler: ["Tom", "Johannes", "Andres", "Ben", "Kilian"],
    sieger: {
      VF1: "Johannes",
      VF2: "Andres",
      VF3: "Kilian",
      G1: "Johannes",
      G2: "Kilian",
      G3: "Kilian",
      V1: "Ben",
    },
  },
];
