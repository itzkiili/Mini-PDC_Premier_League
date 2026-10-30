// =====================================================================
//  Bearbeiten-Leiste unten am Bildschirm: Status, Speichern, Fertig
// =====================================================================
import { el } from "../kern/dom.js";
import { store, load } from "../kern/hilfen.js";
import { state, gh, render } from "../kern/zustand.js";
import { saveToGitHub, downloadFile } from "./speichern.js";
import { openSeasonEnd } from "./saisonwechsel.js";

// Statuszeile setzen und die Leiste neu zeichnen
export function setStatus(text, kind) {
  state.statusText = text;
  state.statusKind = kind || "";
  renderEditBar();
}

export function renderEditBar() {
  const bar = document.getElementById("editbar");
  bar.innerHTML = "";
  if (!state.editing) { bar.hidden = true; return; }
  bar.hidden = false;
  const target = gh.connected ? "Speichert in " + gh.repo + " (" + gh.branch + ")" : "Ohne GitHub-Verbindung – Änderungen bitte als Datei herunterladen";
  bar.appendChild(el("div", null, [
    el("div", { class: "status" + (state.statusKind ? " " + state.statusKind : ""), text: state.statusText || (state.dirty ? "Ungespeicherte Änderungen" : "Keine Änderungen") }),
    el("div", { class: "status", text: target }),
  ]));
  const btns = [];
  if (gh.connected) {
    btns.push(el("button", { class: "btn primary", type: "button", text: state.saving ? "Speichert …" : "Speichern", disabled: state.saving || !state.dirty ? "disabled" : null, onclick: saveToGitHub }));
  }
  btns.push(el("button", { class: "btn" + (gh.connected ? "" : " primary"), type: "button", text: "Datei herunterladen", onclick: downloadFile }));
  if (gh.connected) {
    btns.push(el("button", { class: "btn", type: "button", text: "Saison abschließen", onclick: openSeasonEnd }));
  }
  if (load("liga.token")) {
    btns.push(el("button", { class: "btn", type: "button", text: "Gerät abmelden", onclick: function () {
      store("liga.token", null);
      setStatus("Abgemeldet. Beim nächsten Mal wird wieder das Passwort abgefragt.", "ok");
    } }));
  }
  btns.push(el("button", { class: "btn", type: "button", text: "Fertig", onclick: leaveEdit }));
  bar.appendChild(el("div", { class: "row" }, btns));
}

export function startEdit(text) {
  state.editing = true; state.dirty = false;
  state.statusText = text; state.statusKind = "ok";
  document.getElementById("admin").hidden = true;
  render();
  document.getElementById("spieltage").scrollIntoView({ behavior: "smooth", block: "start" });
}

function leaveEdit() {
  if (state.dirty && !confirm("Es gibt ungespeicherte Änderungen. Trotzdem beenden? Die Änderungen gehen dann verloren.")) return;
  if (state.dirty) location.reload();
  state.editing = false; state.statusText = ""; state.statusKind = "";
  render();
}
