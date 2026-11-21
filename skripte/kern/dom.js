// =====================================================================
//  Bausteine für die Seite: Elemente, SVG, Fenster (dialog)
// =====================================================================

// el("div", { class: "x", text: "Hallo", onclick: fn }, [kinder])
export function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === "text") e.textContent = v;
    else if (k === "class") e.className = v;
    else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  });
  (children || []).forEach(function (c) { if (c) e.appendChild(c); });
  return e;
}

const SVGNS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs, children) {
  const e = document.createElementNS(SVGNS, tag);
  Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  (children || []).forEach(function (c) { if (c) e.appendChild(c); });
  return e;
}

const backdropReady = new WeakSet();   // Fenster, die schon auf Klicks daneben hören

// Letzte Eingabe: Finger/Maus oder Tastatur. Nach dem Schließen eines Fensters
// gibt der Browser den Fokus an das angetippte Element zurück; manche Browser
// (Safari, Android) zeigen dann dessen Fokus-Rahmen an, obwohl man nur getippt
// hat. Deshalb: nach Finger/Maus den Fokus wieder wegnehmen, mit Tastatur lassen.
let lastInput = "pointer";
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", function () { lastInput = "pointer"; }, true);
  document.addEventListener("keydown", function (e) { if (e.key !== "Escape") lastInput = "key"; }, true);
}
function dropFocusAfterClose() {
  if (lastInput !== "pointer") return;
  setTimeout(function () {
    const a = document.activeElement;
    if (a && a !== document.body && !(a.closest && a.closest("dialog[open]")) && typeof a.blur === "function") a.blur();
  }, 0);
}

// Liefert ein Fenster (dialog) und legt es an, falls es in index.html fehlt.
// Ein Klick neben das Fenster schließt es.
export function getDialog(id) {
  let dlg = document.getElementById(id);
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = id;
    document.body.appendChild(dlg);
  }
  if (!dlg.hasAttribute("tabindex")) dlg.setAttribute("tabindex", "-1");
  if (!backdropReady.has(dlg)) {
    backdropReady.add(dlg);
    dlg.addEventListener("click", function (e) {
      if (e.target === e.currentTarget) e.currentTarget.close();
    });
    dlg.addEventListener("close", dropFocusAfterClose);
  }
  return dlg;
}

// Fenster öffnen und den Fokus auf das Fenster selbst legen
// (sonst markiert der Browser das erste Element mit einem Rahmen)
export function openDialog(dlg) {
  if (!dlg.open) dlg.showModal();
  dlg.focus({ preventScroll: true });
  dlg.scrollTop = 0;
}

export function closeDialog(id) {
  const dlg = document.getElementById(id);
  if (dlg && dlg.open) dlg.close();
}

// Schließen-Knopf oben rechts in einem Fenster
export function closeButton(dlg) {
  return el("button", { type: "button", class: "btn close", text: "✕", "aria-label": "Schließen", onclick: function () { dlg.close(); } });
}

// Rückmeldung in einem Formular (z. B. Anmeldung)
export function setMsg(msg, text, kind) {
  msg.className = "status" + (kind ? " " + kind : "");
  msg.textContent = text;
}
