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
  // Dieser Spieltag wird beim Öffnen der Seite angezeigt (weglassen = neuester)
  aktuell: 2,
  // Zeitpunkt der letzten Speicherung (wird automatisch gesetzt)
  stand: "2026-10-26T19:22:28.989Z",
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
    bonus: {
      "Kilian": { co: 24, leg: 22 },
      "Andres": { co: 5, leg: 32 },
      "Johannes": { co: 35, leg: 32 },
      "Ben": { co: 4, leg: 39 },
    },
    statistik: {
      VF2: { "Andres": { avg: 36.41, miss: 39 }, "Ben": { avg: 35.53, miss: 13 } },
      G2: { "Andres": { avg: 45.6, miss: 5 }, "Kilian": { avg: 50.66, miss: 8 } },
      G3: { "Johannes": { avg: 41.05, miss: 24 }, "Kilian": { avg: 43.18, miss: 29 } },
    },
  },
  {
    nr: 2,
    datum: "26.10.2026",
    spieler: ["Johannes", "Philipp", "Leon", "Ben", "Andres", "Moritz", "Kilian", "SchoeSchoe"],
    sieger: {
      VF1: "Johannes",
      VF2: "Leon",
      VF3: "Moritz",
      VF4: "Kilian",
      PR1: "Ben",
    },
    ergebnisse: {
      VF1: { "Johannes": 2, "Philipp": 1 },
      VF2: { "Leon": 2, "Ben": 1 },
      VF3: { "Andres": 1, "Moritz": 2 },
      PR1: { "Philipp": 0, "Ben": 2 },
    },
    bonus: {
      "Ben": { co: 45, leg: 38 },
      "Leon": { co: 9, leg: 29 },
      "Johannes": { co: 64, leg: 31 },
      "Philipp": { co: 16, leg: 35 },
      "Andres": { co: 12, leg: 40 },
      "Moritz": { co: 30, leg: 31 },
      "Kilian": { co: 16, leg: 30 },
    },
    statistik: {
      VF1: { "Johannes": { avg: 43.66, miss: 11 }, "Philipp": { avg: 43.22, miss: 7 } },
      VF2: { "Leon": { avg: 44.5, miss: 18 }, "Ben": { avg: 43.01, miss: 1 } },
      VF3: { "Andres": { avg: 39.11, miss: 7 }, "Moritz": { avg: 40.24, miss: 10 } },
      PR1: { "Philipp": { avg: 35.04, miss: 22 }, "Ben": { avg: 39.55, miss: 13 } },
    },
  },
];
