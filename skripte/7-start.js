// =====================================================================
//  Liga-Seite – Start der Seite
// =====================================================================
"use strict";

// Fenster für Spielerkarte und Vergleich: Klick daneben schließt sie.
// Fehlt ein Fenster in index.html, wird es hier angelegt.
["player-dialog", "compare-dialog"].forEach(function (id) {
  const dlg = getDialog(id);
  dlg.addEventListener("click", function (e) {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });
});

window.addEventListener("beforeunload", function (e) {
  if (editing && dirty) { e.preventDefault(); e.returnValue = ""; }
});

render();