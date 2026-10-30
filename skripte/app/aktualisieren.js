// =====================================================================
//  Aktualisieren in der installierten App
//  Die App hat kein „Ziehen zum Aktualisieren“. Hier ein eigenes: oben an
//  der Seite nach unten ziehen und loslassen. Außerdem lädt die App neu,
//  wenn sie länger als 10 Minuten im Hintergrund war.
//  Beides nicht im Bearbeiten-Modus und nicht bei offenem Fenster.
// =====================================================================
import { state } from "../kern/zustand.js";
import { isStandalone } from "./installieren.js";

const PULL = 70;                   // so weit ziehen (in Pixeln), dann wird neu geladen
const AWAY_MS = 10 * 60 * 1000;    // so lange im Hintergrund, dann wird neu geladen

function blocked() { return state.editing || document.querySelector("dialog[open]"); }

export function initPullToRefresh() {
  if (!isStandalone()) return;

  const ind = document.createElement("div");
  ind.className = "ptr";
  ind.setAttribute("aria-hidden", "true");
  ind.innerHTML = '<span class="ptr-icon">↻</span>';
  document.body.appendChild(ind);

  let startY = null, startX = 0, pull = 0;
  function show(d) {
    ind.classList.add("show");
    ind.classList.toggle("ready", d >= PULL);
    ind.style.transform = "translate(-50%, " + (d - 44) + "px)";
    ind.firstChild.style.transform = "rotate(" + Math.round(d * 4) + "deg)";
  }
  function reset() {
    startY = null; pull = 0;
    ind.classList.remove("show", "ready");
    ind.style.transform = "";
    ind.firstChild.style.transform = "";
  }
  window.addEventListener("touchstart", function (e) {
    if (window.scrollY > 0 || e.touches.length !== 1 || blocked()) { startY = null; return; }
    startY = e.touches[0].clientY; startX = e.touches[0].clientX; pull = 0;
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY, dx = e.touches[0].clientX - startX;
    // nur senkrecht nach unten und ganz oben an der Seite (nicht beim Wischen der Spieltage)
    if (dy <= 0 || window.scrollY > 0 || Math.abs(dx) > dy) { reset(); return; }
    pull = Math.min(dy * 0.5, 110);
    show(pull);
  }, { passive: true });
  window.addEventListener("touchend", function () {
    if (startY === null) return;
    if (pull >= PULL) {
      startY = null;
      ind.classList.add("loading");
      ind.style.transform = "translate(-50%, 24px)";
      location.reload();
    } else {
      reset();
    }
  });
  window.addEventListener("touchcancel", reset);

  // Nach längerer Pause im Hintergrund automatisch den neuesten Stand holen
  let hiddenAt = null;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && !blocked()) location.reload();
    hiddenAt = null;
  });
}
