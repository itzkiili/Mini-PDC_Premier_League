// =====================================================================
//  ERGEBNISSE – nur diese Datei musst du bearbeiten
// =====================================================================
//
//  So trägst du einen neuen Spieltag ein:
//
//  1. Kopiere einen kompletten Spieltag-Block von  {  bis  },
//     und füge ihn am Ende der Liste ein (vor der Zeile  ];  ).
//  2. Trag Nummer und Datum ein.
//  3. Trag die Spieler in der Reihenfolge A bis H ein:
//        VF1: Spieler 1 gegen 2     VF2: Spieler 3 gegen 4
//        VF3: Spieler 5 gegen 6     VF4: Spieler 7 gegen 8
//     Spielen weniger als 8 mit, schreib für jeden freien Platz  null
//     (ohne Anführungszeichen). Der Gegner kommt dann kampflos weiter.
//  4. Trag bei jedem Spiel den Namen des Siegers ein, sobald es gespielt
//     ist. Noch nicht gespielt? Einfach  ""  stehen lassen.
//
//  Wichtig:
//  - Namen immer genau gleich schreiben (z. B. immer "Max", nie "max"),
//    sonst zählt die Seite sie als zwei verschiedene Spieler.
//  - Jeder Name steht in Anführungszeichen, danach kommt ein Komma.
//  - Wer an einem Spieltag nicht dabei ist, bekommt automatisch keine Punkte.
//
//  Die Seite zeigt oben einen roten Hinweis, wenn ein Sieger nicht zu
//  den Spielern des Spiels passt (z. B. bei einem Tippfehler).
// =====================================================================

const LIGA = {
  name: "Liga 2026/27",
  // Punkte für Platz 1 bis 8 an jedem Spieltag
  punkte: [15, 13, 12, 10, 9, 7, 6, 4],
};

const SPIELTAGE = [
  {
    nr: 1,
    datum: "19.10.2026",
    //         A        B       C        D        E       F        G        H
    spieler: ["Tom", "Johannes", "Andres", "Ben", "Kilian"],
    sieger: {
      // Viertelfinale
      VF1: "Johannes",
      VF2: "Andres",
      VF3: "Kilian",
      // Gewinnerrunde
      G1: "Kilian",
      G2: "Johannes",
      G3: "Andres",
      // Verliererrunde
      V1: "Ben",
      V2: "Tom",
    },
  }
];
