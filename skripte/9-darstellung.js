// =====================================================================
//  Liga-Seite – Hell-/Dunkel-Modus
//  Die Wahl wird pro Gerät gespeichert. Standard ist dunkel.
// =====================================================================
"use strict";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  try { localStorage.setItem("liga.theme", theme); } catch (e) { /* nicht verfügbar */ }
  updateThemeColor();
  updateThemeButton();
}

// Farbe der Statusleiste am Handy anpassen
function updateThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", currentTheme() === "light" ? "#f4f5f0" : "#0d1015");
}

function updateThemeButton() {
  const b = document.getElementById("theme-toggle");
  if (!b) return;
  const light = currentTheme() === "light";
  b.textContent = light ? "☾ Dunkel" : "☀ Hell";
  b.setAttribute("aria-label", light ? "Dunkles Design einschalten" : "Helles Design einschalten");
}

(function () {
  const nav = document.querySelector("header nav");
  if (!nav || document.getElementById("theme-toggle")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.id = "theme-toggle";
  b.className = "theme-toggle";
  b.addEventListener("click", function () { applyTheme(currentTheme() === "light" ? "dark" : "light"); });
  nav.appendChild(b);
  updateThemeColor();
  updateThemeButton();
})();