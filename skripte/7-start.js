// =====================================================================
//  Liga-Seite – Start der Seite
// =====================================================================
"use strict";

document.getElementById("player-dialog").addEventListener("click", function (e) {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

window.addEventListener("beforeunload", function (e) {
  if (editing && dirty) { e.preventDefault(); e.returnValue = ""; }
});

render();
