// =====================================================================
//  Fußzeile: Stand der Daten, „Als App installieren“, „Ergebnisse bearbeiten“
// =====================================================================
import { el } from "../kern/dom.js";
import { state, viewingArchive } from "../kern/zustand.js";
import { installButton } from "../app/installieren.js";
import { openAdmin } from "../bearbeiten/anmeldung.js";

// Zeitpunkt der letzten Speicherung, z. B. „24.10.2026, 22:14 Uhr“
function fmtStand(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + ", " +
    d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

export function renderFooter() {
  const f = document.getElementById("footer");
  f.innerHTML = "";
  const stand = fmtStand(state.liga.stand);
  f.appendChild(el("span", { text: (stand ? "Stand: " + stand + " · " : "") + "Tabelle wird automatisch aus den Ergebnissen berechnet." }));
  const links = el("span", { class: "footer-links" }, [installButton()]);
  if (!state.editing && !viewingArchive()) {
    links.appendChild(el("button", { class: "linkbtn", type: "button", text: "Ergebnisse bearbeiten", onclick: function () { openAdmin(false); } }));
  }
  f.appendChild(links);
}
