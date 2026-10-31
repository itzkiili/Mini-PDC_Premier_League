# 🎯 Dartliga – Tabelle & Spieltage

Website für unsere Dartliga: Gesamttabelle, alle Spieltage mit Turnierbaum, Spielerstatistiken und das Saisonfinale. Die Seite läuft kostenlos über **GitHub Pages**. Ergebnisse lassen sich direkt auf der Website eintragen, die Tabelle rechnet sich automatisch.

**➡️ Zur Liga:** https://itzkiili.github.io/Mini-PDC_Premier_League/

---

## Funktionen

- **Gesamttabelle** mit Punkten, Spieltagsiegen, Legs, Differenz, Average, Checkout-Quote und Bonuspunkten, dazu Trendpfeilen (▲ ▼) seit dem letzten Spieltag
- **Spieltage** mit Turnierbaum (7–8 Spieler) oder Dreiergruppen (5–6 Spieler) und der Platzierung des Tages
- **Spielerkarte:** Klick auf einen Namen zeigt Statistiken, den Platzierungsverlauf, die Bilanz gegen jeden Gegner, Lieblings- und Angstgegner
- **Direktvergleich** zweier Spieler: direkte Duelle, Saisonwerte als Balken, gemeinsamer Verlauf
- **Saisonfinale:** vorläufiges Bracket der Top 8 nach aktuellem Tabellenstand
- **Bearbeiten-Modus:** Spieler, Legs, Average, Missed Doubles und Bonuswerte direkt auf der Seite eintragen, mit Passwort geschützt und automatisch auf GitHub gespeichert
- **Regelwerk** als PDF verlinkt
- **Als App** auf Android und iPhone installierbar, auch ohne Internet nutzbar

---

## Spielmodus

| Teilnehmer | Format |
|---|---|
| 7–8 Spieler | Viertelfinale → Halbfinale (Plätze 1–4) und Platzierungsrunde (Plätze 5–8); jeder Platz wird ausgespielt |
| 5–6 Spieler | 3 Viertelfinals → Gewinnergruppe (Plätze 1–3) und Verlierergruppe (Plätze 4–6), jeweils jeder gegen jeden; bei Gleichstand Stechen |

**Spielformat:** standardmäßig 501 Double Out, Best of 3, großes Finale Best of 5. Für die ganze Saison lässt sich das in `daten/ergebnisse.js` bei `LIGA` ändern, z. B. `modus: { legs: 3, legsFinale: 4 }` für Best of 5 und im Finale Best of 7. Für Spezial-Spieltage wählt man im Bearbeiten-Modus beim Spieltag einen eigenen Modus (siehe unten).

**Punkte pro Spieltag:**

| Platz | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 7–8 Spieler | 15 | 13 | 11 | 9 | 9 | 7 | 6 | 5 |
| 5–6 Spieler | 15 | 13 | 11 | 9 | 7 | 6 | | |

**Bonuspunkte pro Spieltag:** höchstes Checkout +1, kürzestes Leg +1, jede 180 +1. Bei gleichem Bestwert bekommen alle den Bonus.

**Bei Punktgleichheit in der Gesamttabelle:**
1. Direkter Vergleich (sofern jeder gegen jeden gespielt hat)
2. Legdifferenz über die Saison
3. Gewonnene Spieltage
4. Entscheidungsleg oder Stechen

**Saisonfinale:** 1–8, 4–5, 2–7, 3–6 → Halbfinale → Finale

Das vollständige Regelwerk steht im PDF im Repository.


---

## Ergebnisse eintragen

### Auf der Website (empfohlen)

1. Ganz unten auf **Ergebnisse bearbeiten** klicken und das Passwort eingeben.
2. **+ Neuer Spieltag** anlegen und die Spieler in die Felder A–H eintragen.
   - VF1: A gegen B · VF2: C gegen D · VF3: E gegen F · VF4: G gegen H
   - Bei 5 oder 6 Spielern nur die ersten Felder ausfüllen.
3. Im Turnierbaum die **Legs** mit − / + eintragen. Der Sieger wird automatisch gesetzt. Alternativ einfach auf den Namen des Siegers klicken.
4. Bei einem Spezial-Spieltag unter **Spielmodus an diesem Spieltag** den Modus wählen: Double In, 170er-Legs, Master Out oder einen eigenen Modus mit Startpunkten, Checkout und Gewinnlegs.
5. Optional unter **▾ Average & Doppel** Average und Missed Doubles eintragen und unter **Bonuspunkte** High Finish, kürzestes Leg und 180er.
6. Unten auf **Speichern** klicken. Nach etwa einer Minute sehen alle den neuen Stand.

### Mit dem Live-Zähler

1. Im Turnierbaum bei einem offenen Spiel auf **▶ Live zählen** tippen. Das Format (z. B. Best of 3, 170er-Legs) kommt aus dem Spielmodus des Spieltags und lässt sich vor dem ersten Leg für dieses Spiel ändern.
2. Auswählen, wer das Ausbullen gewonnen hat. Danach wechselt der Anwurf jedes Leg automatisch.
3. Pro Aufnahme die Punkte eintippen (oder Schnellwahl, am Computer auch per Tastatur). **Bust** bei Überworfen, **⌫** löscht die letzte Ziffer oder macht die letzte Aufnahme rückgängig.
4. Steht ein Spieler auf einem Finish, fragt der Zähler kurz nach den **Darts aufs Doppel**; beim Checkout, mit dem wievielten Dart gecheckt wurde.
5. Am Ende im Bearbeiten-Modus **Ins Ergebnis übernehmen** und danach **Speichern**.

Übernommen werden Legs, Sieger, Checkout-Quote, High Finish und 180er. Average und kürzestes Leg nur im normalen Modus (501 Double Out), weil sie bei Spezial-Modi nicht vergleichbar sind. Das laufende Spiel bleibt auf dem Handy gespeichert, auch wenn die Seite neu lädt.

### Von Hand

Alle Daten stehen in `ergebnisse.js`. Oben in der Datei steht eine Anleitung zum Aufbau. Wichtig: Namen immer genau gleich schreiben (`"Max"`, nie `"max"`).

---

### Saisonwechsel

1. Im Bearbeiten-Modus (mit GitHub verbunden) auf **Saison abschließen** klicken.
2. Namen der alten Saison, Kürzel (z. B. `2026-27`) und Namen der neuen Saison prüfen und bestätigen.
3. Die Seite archiviert die Saison nach `daten/archiv/2026-27.js`, trägt sie in `daten/saisons.js` ein und beginnt eine leere neue Saison mit denselben Punkte- und Bonusregeln.

Alte Saisons sind oben über die **Saisonauswahl** abrufbar, direkt verlinkbar mit `?saison=2026-27`, und lassen sich nicht mehr bearbeiten.

---

## Dateien

```
index.html          Aufbau der Seite
service-worker.js   startet die App-Funktion (muss im Hauptordner liegen)
daten/
  ergebnisse.js       alle Ergebnisse und Einstellungen der Liga (Daten)
  saisons.js          Liste der archivierten Saisons
  archiv/             abgeschlossene Saisons (eine Datei pro Saison)
  spieler.js          Spielerprofile: Spitzname, Bild, Walk-on-Song
  bilder/             Profilbilder
  zugang.js           verschlüsselter Zugang für den Bearbeiten-Modus (nicht von Hand ändern)
dokumente/
  Regelwerk.pdf       Regelwerk
app/
  manifest.webmanifest  App-Name, Farben, Icons
  service-worker.js     Offline-Speicher der App (Liste aller Dateien)
  icons/                App-Icons und Favicon
css/
  style.css         Aussehen (Farben, Schrift, Layout)
werkzeuge/
  pruefen.mjs       Prüfung vor dem Hochladen (siehe unten)
  zaehler-test.mjs  Tests für die Logik des Live-Zählers
skripte/
  main.js           Start: einziger Einstiegspunkt, ruft alles in der richtigen Reihenfolge auf
  kern/             Grundlagen, von allen genutzt
    zustand.js        Zustand der Seite (state) und render()
    konstanten.js     Dateipfade, Punkte, Elo-Einstellungen, Namen der Spiele
    daten.js          liest die Dateien aus daten/
    dom.js            Bausteine für Elemente und Fenster
    hilfen.js         kleine Hilfsfunktionen (Zahlen, Base64, Gerätespeicher)
  auswertung/       Berechnungen, ohne etwas anzuzeigen
    spieltag.js       Turnierbaum, Dreiergruppen, Platzierungen, Bonuspunkte
    tabelle.js        Gesamttabelle und Gleichstandsregeln
    elo.js            Elo-Wertung über alle Saisons, Siegchance
    statistik.js      Spielerstatistik, direkte Duelle
    modus.js          Spielmodus: Startpunkte, Double In/Out, Gewinnlegs
    erfolge.js        Erfolge und ihre Stufen (Grenzwerte hier anpassen)
  anzeige/          alles, was gezeichnet wird
    seite.js          render(): baut die ganze Seite neu auf
    tabelle.js        Gesamttabelle mit Trendpfeilen
    spieltag.js       ein Spieltag mit Turnierbaum oder Gruppen
    saisonfinale.js   vorläufiges Bracket der Top 8
    spielerkarte.js   Spielerkarte
    vergleich.js      Direktvergleich zweier Spieler
    weltrangliste.js  ewige Elo-Rangliste
    naechstes-spiel.js  „Nächstes Spiel“ oben auf der Seite
    erfolge.js        Abzeichen in der Spielerkarte, „🎉 Neu“ am Spieltag
    profil.js         Bild, Spitzname, Walk-on-Song
    saisonauswahl.js  Saisonauswahl und Archiv
    navigation.js     Links auf Spieltage (#spieltag-3)
    fusszeile.js      Fußzeile
  bearbeiten/       Bearbeiten-Modus
    eingabe.js        Eingabefelder: Spieler, Legs, Average, Bonus, Stechen
    leiste.js         Leiste unten: Status, Speichern, Fertig
    anmeldung.js      Passwort, Zugang einrichten, Verbindung zu GitHub
    verschluesselung.js  Token mit dem Passwort ver- und entschlüsseln
    github.js         Dateien bei GitHub lesen und schreiben
    datei.js          ergebnisse.js erzeugen
    speichern.js      Speichern bei GitHub oder als Datei
    zusammenfuehren.js  gleichzeitige Änderungen zusammenführen
    saisonwechsel.js  Saison abschließen
    profil-editor.js  Spielerprofil bearbeiten
  zaehler/          Live-Zähler
    spiel.js          Aufnahmen, Bust, Legs, Statistik (reine Berechnung)
    checkout.js       mögliche Finishes und Checkout-Vorschläge
    anzeige.js        Bildschirm des Zählers
    uebernehmen.js    Ergebnis in den Spieltag schreiben
  app/              Installation als App
    installieren.js   Service Worker, „Als App installieren“
    regelwerk.js      PDF-Ansicht in der App
    aktualisieren.js  Ziehen zum Aktualisieren
    design.js         Hell-/Dunkel-Modus
```

### Am Code arbeiten

- Die Skripte sind **ES-Module** (`import`/`export`). Deshalb funktioniert die Seite nur über einen Webserver, nicht per Doppelklick auf `index.html`. Zum Testen auf dem eigenen Rechner im Ordner `python3 -m http.server` starten und `http://localhost:8000` öffnen.
- Alles, was sich ändert (Daten, Bearbeiten-Modus, Saison), steht in `state` in `skripte/kern/zustand.js`. Nach einer Änderung `render()` aufrufen, im Bearbeiten-Modus `changed()`.
- **Neue Datei in `skripte/`?** In `app/service-worker.js` in die Liste `CORE` eintragen und `CACHE_VERSION` hochzählen. `node werkzeuge/pruefen.mjs` meldet vergessene Einträge, falsche Importe und Tippfehler.
- Änderungen am Zähler: `node werkzeuge/zaehler-test.mjs` prüft Checkouts, Bust, Legs, Statistik und das Übernehmen.
