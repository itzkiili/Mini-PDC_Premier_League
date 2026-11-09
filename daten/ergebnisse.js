// =====================================================================
//  ERGEBNISSE
// =====================================================================
//
//  Diese Datei kannst du auf der Seite über „Ergebnisse bearbeiten“
//  ändern oder weiterhin hier von Hand bearbeiten.
//
//  Spielmodus (optional, bei LIGA für die Saison oder bei einem Spieltag):
//  - modus: { start: 501, ein: "single", aus: "double", legs: 2, legsFinale: 3 }
//        start: Startpunkte   ein: "double" = Double In
//        aus: "double", "master" (Doppel oder Triple) oder "single"
//        legs: Gewinnlegs (2 = Best of 3)   legsFinale: Gewinnlegs im Finale
//        legsPlus: zusätzliche Gewinnlegs an einem Spieltag (170er-Legs: 1)
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
//        vom Live-Zähler zusätzlich: First-9-Average (f9) und Anzahl der
//        Aufnahmen 100–139 (t100) und 140–179 (t140)
//        Checkout-Quote = gewonnene Legs / (gewonnene Legs + Missed Doubles)
//  - stechen: nur bei Gleichstand in einer Dreiergruppe, Reihenfolge ab Platz 1
//
//  Namen immer genau gleich schreiben (z. B. immer "Max", nie "max").
// =====================================================================

const LIGA = {
  name: "Liga 2026/27",
  // Punkte für Platz 1 bis 8 bei 7–8 Spielern
  punkte: [15, 13, 11, 9, 9, 7, 6, 5],
  // Punkte für Platz 1 bis 6 bei 5–6 Spielern
  punkteKlein: [15, 13, 11, 9, 7, 6],
  // Bonuspunkte: höchstes Checkout und kürzestes Leg je Spieltag, jede 180
  bonus: { checkout: 1, leg: 1, je180: 1 },
  // Dieser Spieltag wird beim Öffnen der Seite angezeigt (weglassen = neuester)
  aktuell: 4,
  // Zeitpunkt der letzten Speicherung (wird automatisch gesetzt)
  stand: "2026-11-09T19:47:31.899Z",
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
      PR2: "Andres",
      HF1: "Leon",
      HF2: "Kilian",
      P7: "Philipp",
      P5: "Ben",
      P3: "Johannes",
      Finale: "Leon",
    },
    ergebnisse: {
      VF1: { "Johannes": 2, "Philipp": 1 },
      VF2: { "Leon": 2, "Ben": 1 },
      VF3: { "Andres": 1, "Moritz": 2 },
      VF4: { "Kilian": 2, "SchoeSchoe": 0 },
      PR1: { "Philipp": 0, "Ben": 2 },
      PR2: { "Andres": 2, "SchoeSchoe": 0 },
      HF1: { "Johannes": 1, "Leon": 2 },
      HF2: { "Moritz": 0, "Kilian": 2 },
      P7: { "Philipp": 2, "SchoeSchoe": 1 },
      P5: { "Ben": 2, "Andres": 1 },
      P3: { "Johannes": 2, "Moritz": 0 },
      Finale: { "Leon": 3, "Kilian": 0 },
    },
    bonus: {
      "Ben": { co: 60, leg: 32 },
      "Leon": { co: 26, leg: 28 },
      "Johannes": { co: 78, leg: 30 },
      "Philipp": { co: 16, leg: 35 },
      "Andres": { co: 66, leg: 29 },
      "Moritz": { co: 30, leg: 31 },
      "Kilian": { co: 16, leg: 30 },
      "SchoeSchoe": { co: 4, leg: 64 },
    },
    statistik: {
      VF1: { "Johannes": { avg: 43.66, miss: 11 }, "Philipp": { avg: 43.22, miss: 7 } },
      VF2: { "Leon": { avg: 44.5, miss: 18 }, "Ben": { avg: 43.01, miss: 1 } },
      VF3: { "Andres": { avg: 39.11, miss: 7 }, "Moritz": { avg: 40.24, miss: 10 } },
      VF4: { "Kilian": { avg: 39.55, miss: 6 }, "SchoeSchoe": { avg: 31.76, miss: 2 } },
      PR1: { "Philipp": { avg: 35.04, miss: 22 }, "Ben": { avg: 39.55, miss: 13 } },
      PR2: { "Andres": { avg: 50.95, miss: 2 }, "SchoeSchoe": { avg: 45.32, miss: 0 } },
      HF1: { "Johannes": { avg: 40.06, miss: 4 }, "Leon": { avg: 46.2, miss: 9 } },
      HF2: { "Moritz": { avg: 21.5, miss: 15 }, "Kilian": { avg: 25.26, miss: 37 } },
      P7: { "Philipp": { avg: 27.29, miss: 32 }, "SchoeSchoe": { avg: 27.6, miss: 17 } },
      P5: { "Ben": { avg: 37.18, miss: 14 }, "Andres": { avg: 35.62, miss: 21 } },
      P3: { "Johannes": { avg: 28.63, miss: 18 }, "Moritz": { avg: 28.29, miss: 19 } },
      Finale: { "Leon": { avg: 49.55, miss: 8 }, "Kilian": { avg: 47.42, miss: 13 } },
    },
  },
  {
    nr: 3,
    datum: "02.11.2026",
    modus: { start: 170, legsPlus: 1 },
    spieler: ["Kilian", "Andres", "Philipp", "Tom", "Ben", "Johannes", "Leon", "Max"],
    sieger: {
      VF1: "Andres",
      VF2: "Tom",
      VF3: "Johannes",
      VF4: "Leon",
      PR1: "Kilian",
      PR2: "Max",
      HF1: "Andres",
      HF2: "Johannes",
      P7: "Ben",
      P5: "Kilian",
      P3: "Leon",
      Finale: "Andres",
    },
    ergebnisse: {
      VF1: { "Kilian": 0, "Andres": 3 },
      VF2: { "Philipp": 1, "Tom": 3 },
      VF3: { "Ben": 1, "Johannes": 3 },
      VF4: { "Leon": 3, "Max": 1 },
      PR1: { "Kilian": 3, "Philipp": 1 },
      PR2: { "Ben": 2, "Max": 3 },
      HF1: { "Andres": 3, "Tom": 0 },
      HF2: { "Johannes": 3, "Leon": 1 },
      P7: { "Philipp": 1, "Ben": 3 },
      P5: { "Kilian": 3, "Max": 2 },
      P3: { "Tom": 0, "Leon": 3 },
      Finale: { "Andres": 4, "Johannes": 3 },
    },
    bonus: {
      "Andres": { co: 50, leg: 6 },
      "Philipp": { co: 57, leg: 56 },
      "Tom": { co: 20 },
      "Ben": { co: 68, leg: 8 },
      "Johannes": { co: 42, leg: 7 },
      "Leon": { co: 89, leg: 8 },
      "Max": { co: 48, leg: 14 },
      "Kilian": { co: 40, leg: 8 },
    },
    statistik: {
      VF1: { "Kilian": { miss: 4, t100: 0, t140: 0 }, "Andres": { miss: 12, t100: 1, t140: 0 } },
      VF2: { "Philipp": { avg: 19.11, miss: 29, t100: 0, t140: 0 }, "Tom": { avg: 21.32, miss: 37, t100: 0, t140: 0 } },
      VF3: { "Ben": { avg: 21.3, miss: 41, t100: 0, t140: 0 }, "Johannes": { avg: 21.83, miss: 34, t100: 1, t140: 0 } },
      VF4: { "Leon": { avg: 23.28, miss: 20, t100: 1, t140: 0 }, "Max": { avg: 19.27, miss: 21, t100: 1, t140: 0 } },
      PR1: { "Kilian": { avg: 32.95, miss: 20, t100: 0, t140: 0 }, "Philipp": { avg: 34.34, miss: 11, t100: 0, t140: 0 } },
      PR2: { "Ben": { avg: 20.82, miss: 40, t100: 0, t140: 0 }, "Max": { avg: 19.87, miss: 38, t100: 0, t140: 0 } },
      HF1: { "Andres": { avg: 27.82, miss: 23, t100: 0, t140: 1 }, "Tom": { avg: 19.94, miss: 15, t100: 0, t140: 0 } },
      HF2: { "Johannes": { avg: 41.22, miss: 7, t100: 1, t140: 0 }, "Leon": { avg: 40.7, miss: 5, t100: 0, t140: 0 } },
      P7: { "Philipp": { avg: 20.17, miss: 28, t100: 1, t140: 0 }, "Ben": { avg: 20.97, miss: 38, t100: 0, t140: 0 } },
      P5: { "Kilian": { avg: 25.41, miss: 37, t100: 0, t140: 0 }, "Max": { avg: 23.16, miss: 22, t100: 0, t140: 0 } },
      P3: { "Tom": { avg: 24.83, miss: 5, t100: 0, t140: 0 }, "Leon": { avg: 27.82, miss: 14, t100: 0, t140: 0 } },
      Finale: { "Andres": { avg: 18.8, miss: 61, t100: 0, t140: 0 }, "Johannes": { avg: 21.74, miss: 56, t100: 1, t140: 0 } },
    },
  },
  {
    nr: 4,
    datum: "09.11.2026",
    spieler: ["Tom", "Leon", "Kilian", "Ben", "Philipp", "Andres", "Johannes", "Jonas"],
    sieger: {
      VF1: "Leon",
      VF2: "Kilian",
      VF3: "Andres",
      VF4: "Johannes",
      PR1: "Tom",
      PR2: "Jonas",
    },
    ergebnisse: {
      VF1: { "Tom": 1, "Leon": 2 },
      VF2: { "Kilian": 2, "Ben": 0 },
      VF3: { "Philipp": 1, "Andres": 2 },
      VF4: { "Johannes": 2, "Jonas": 0 },
      PR1: { "Tom": 2, "Ben": 1 },
      PR2: { "Philipp": 0, "Jonas": 2 },
    },
    bonus: {
      "Kilian": { co: 10, leg: 34 },
      "Tom": { co: 40, leg: 41 },
      "Leon": { co: 40, leg: 31 },
      "Philipp": { co: 10, leg: 46 },
      "Andres": { co: 62, leg: 31 },
      "Johannes": { co: 49, leg: 30 },
      "Ben": { co: 8, leg: 46 },
      "Jonas": { co: 20, leg: 34 },
    },
    statistik: {
      VF1: { "Tom": { avg: 32.58, miss: 17, f9: 32, t100: 1, t140: 0 }, "Leon": { avg: 37.84, miss: 19, f9: 55.33, t100: 2, t140: 1 } },
      VF2: { "Kilian": { avg: 42.94, miss: 14, f9: 47.67, t100: 2, t140: 0 }, "Ben": { avg: 39.52, miss: 4, f9: 52.83, t100: 0, t140: 0 } },
      VF3: { "Philipp": { avg: 37.5, miss: 13, f9: 38.11, t100: 0, t140: 0 }, "Andres": { avg: 39.1, miss: 14, f9: 41.67, t100: 0, t140: 0 } },
      VF4: { "Johannes": { avg: 46.25, miss: 9, f9: 51.5, t100: 0, t140: 0 }, "Jonas": { avg: 40.48, miss: 1, f9: 39, t100: 0, t140: 0 } },
      PR1: { "Tom": { avg: 32.02, miss: 13, f9: 32, t100: 0, t140: 0 }, "Ben": { avg: 33.32, miss: 35, f9: 60.89, t100: 2, t140: 0 } },
      PR2: { "Philipp": { avg: 31.29, miss: 3, f9: 37.83, t100: 0, t140: 0 }, "Jonas": { avg: 36.22, miss: 24, f9: 58.67, t100: 1, t140: 1 } },
    },
  },
];
