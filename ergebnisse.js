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
//  - ergebnisse: Legs je Spiel, z. B. VF1: { "Anna": 3, "Ben": 1 }
//        (optional; der Sieger ergibt sich dann aus den Legs)
//  - bonus: optional je Spieler und Spieltag: höchstes Checkout (co),
//        kürzestes Leg in Darts (leg) und Anzahl 180er (n180),
//        z. B. bonus: { "Anna": { co: 121, n180: 2 }, "Ben": { leg: 15 } }
//  - statistik: optional je Spiel und Spieler Average (avg) und Missed
//        Doubles (miss), z. B. VF1: { "Anna": { avg: 54.3, miss: 4 } }
//        Checkout-Quote = gewonnene Legs / (gewonnene Legs + Missed Doubles)
//  - stechen: nur bei Gleichstand in einer Dreiergruppe, Reihenfolge ab Platz 1
//
//  Namen immer genau gleich schreiben (z. B. immer "Max", nie "max").
// =====================================================================

const LIGA = {
  name: "Liga 2026/27",
  // Punkte für Platz 1 bis 8 an jedem Spieltag
  punkte: [15, 12, 10, 8, 7, 6, 5, 4],
  // Bonuspunkte: höchstes Checkout und kürzestes Leg je Spieltag, jede 180
  bonus: { checkout: 1, leg: 1, je180: 1 },
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
    ergebnisse: {
      VF1: { "Tom": 0, "Johannes": 2 },
      VF2: { "Andres": 2, "Ben": 1 },
      G1: { "Johannes": 3, "Andres": 0 },
      G2: { "Andres": 0, "Kilian": 3 },
      G3: { "Johannes": 2, "Kilian": 3 },
      V1: { "Tom": 0, "Ben": 3 },
    },
    statistik: {
      G2: { "Andres": { avg: 45.6, miss: 5 }, "Kilian": { avg: 50.66, miss: 8 } },
      G3: { "Johannes": { avg: 41.05, miss: 24 }, "Kilian": { avg: 43.18, miss: 29 } },
    },
  },
  {
    nr: 2,
    datum: "23.10.2026",
    spieler: ["Kilian", "Johannes", "Tom", "Ben", "Philipp", "Andres", "Leon", "Jonas"],
    sieger: {
      VF1: "Johannes",
      VF2: "Tom",
      VF3: "Philipp",
      VF4: "Leon",
      PR1: "Ben",
      PR2: "Jonas",
      HF1: "Tom",
      HF2: "Philipp",
      P7: "Andres",
      P5: "Ben",
      P3: "Leon",
      Finale: "Tom",
    },
    ergebnisse: {
      VF1: { "Kilian": 1, "Johannes": 2 },
      VF2: { "Tom": 2, "Ben": 1 },
      VF3: { "Philipp": 2, "Andres": 1 },
      VF4: { "Leon": 2, "Jonas": 0 },
      PR1: { "Kilian": 0, "Ben": 2 },
      PR2: { "Andres": 1, "Jonas": 2 },
      HF1: { "Johannes": 0, "Tom": 3 },
      HF2: { "Philipp": 2, "Leon": 1 },
      P7: { "Kilian": 0, "Andres": 2 },
      P5: { "Ben": 3, "Jonas": 2 },
      P3: { "Johannes": 0, "Leon": 3 },
      Finale: { "Tom": 4, "Philipp": 1 },
    },
    bonus: {
      "Johannes": { co: 50 },
      "Ben": { leg: 22 },
      "Andres": { n180: 1 },
      "Leon": { n180: 1 },
      "Jonas": { n180: 1 },
      "Tom": { co: 40, leg: 24 },
    },
    statistik: {
      VF3: { "Philipp": { avg: 44, miss: 1 }, "Andres": { avg: 33, miss: 2 } },
    },
  },
];
