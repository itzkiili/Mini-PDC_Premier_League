// =====================================================================
//  Liga-Seite – Start
//  Einziger Einstiegspunkt (in index.html als <script type="module">).
//  Alle anderen Dateien legen nur Funktionen an; was beim Öffnen der
//  Seite passiert, steht hier in der richtigen Reihenfolge.
//
//  Aufbau der Ordner:
//    kern/         Zustand, Konstanten, Hilfsfunktionen, Daten lesen
//    auswertung/   Berechnungen ohne Seite: Spieltag, Tabelle, Elo, Statistik, Erfolge
//    anzeige/      alles, was gezeichnet wird
//    bearbeiten/   Bearbeiten-Modus: Eingabe, Anmeldung, Speichern bei GitHub
//    app/          Installation als App, Regelwerk-Ansicht, Hell/Dunkel
// =====================================================================
import { state, render } from "./kern/zustand.js";
import { initPage } from "./anzeige/seite.js";
import { hashDayNr, dayIdxByNr, scrollToDays } from "./anzeige/navigation.js";
import { renderWorldSection } from "./anzeige/weltrangliste.js";
import { showSeasonFromUrl, loadArchivesForElo } from "./anzeige/saisonauswahl.js";
import { initSongStop } from "./anzeige/profil.js";
import { initThemeToggle } from "./app/design.js";
import { initApp } from "./app/installieren.js";
import { initRulesViewer } from "./app/regelwerk.js";
import { initPullToRefresh } from "./app/aktualisieren.js";

initThemeToggle();
initPage();
initSongStop();
initApp();
initRulesViewer();

// Ungespeicherte Änderungen: vor dem Verlassen der Seite nachfragen
window.addEventListener("beforeunload", function (e) {
  if (state.editing && state.dirty) { e.preventDefault(); e.returnValue = ""; }
});

// Link mit #spieltag-3: diesen Spieltag öffnen und hinscrollen
window.addEventListener("hashchange", function () {
  const nr = hashDayNr();
  if (nr === null) return;
  const i = dayIdxByNr(nr);
  if (i >= 0 && i !== state.currentIdx) { state.currentIdx = i; render(); }
  scrollToDays();
});

render();
renderWorldSection();
initPullToRefresh();
if (hashDayNr() !== null) requestAnimationFrame(scrollToDays);

// Archiv aus dem Link (?saison=…) öffnen und ältere Saisons für die Elo-Wertung laden
showSeasonFromUrl();
loadArchivesForElo();
