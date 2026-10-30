// =====================================================================
//  Hell-/Dunkel-Modus
//  Die Wahl wird pro Gerät gespeichert. Standard ist dunkel.
//  (Ein kleines Skript im <head> von index.html setzt sie schon vor dem
//  ersten Zeichnen, damit nichts flackert.)
// =====================================================================
import { store } from "../kern/hilfen.js";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  store("liga.theme", theme);
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
  b.textContent = light ? "☾" : "☀";
  b.setAttribute("aria-label", light ? "Dunkles Design einschalten" : "Helles Design einschalten");
  b.title = light ? "Dunkles Design" : "Helles Design";
}

// Knopf ☀/☾ oben rechts anlegen
export function initThemeToggle() {
  const header = document.querySelector("header");
  if (!header || document.getElementById("theme-toggle")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.id = "theme-toggle";
  b.className = "theme-toggle";
  b.addEventListener("click", function () { applyTheme(currentTheme() === "light" ? "dark" : "light"); });
  header.appendChild(b);
  updateThemeColor();
  updateThemeButton();
}
