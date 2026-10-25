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

// Link mit #spieltag-3: diesen Spieltag öffnen und hinscrollen
function scrollToDays() {
  const sec = document.getElementById("spieltage");
  if (sec) sec.scrollIntoView();
}
window.addEventListener("hashchange", function () {
  const nr = hashDayNr();
  if (nr === null) return;
  const i = dayIdxByNr(nr);
  if (i >= 0 && i !== currentIdx) { currentIdx = i; render(); }
  scrollToDays();
});

render();
if (hashDayNr() !== null) requestAnimationFrame(scrollToDays);