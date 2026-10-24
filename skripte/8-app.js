// =====================================================================
//  Liga-Seite – Als App auf dem Handy (Installation, Offline-Nutzung)
// =====================================================================
"use strict";

// Service Worker registrieren (nur über http/https, nicht per Doppelklick)
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("service-worker.js").catch(function () { /* egal */ });
  });
}

// Android/Chrome: Installationsdialog merken, um ihn per Knopf zu öffnen
let installPrompt = null;
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  installPrompt = e;
  renderFooter();
});
window.addEventListener("appinstalled", function () {
  installPrompt = null;
  renderFooter();
});

function isStandalone() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// Knopf im Fußbereich: Installation starten oder Anleitung zeigen
function installButton() {
  if (isStandalone()) return null;
  return el("button", { class: "linkbtn", type: "button", text: "📱 Als App installieren", onclick: function () { showInstallHelp(); } });
}

function showInstallHelp(forceIos) {
  if (installPrompt && typeof forceIos !== "boolean") {
    installPrompt.prompt();
    installPrompt.userChoice.finally(function () { installPrompt = null; renderFooter(); });
    return;
  }
  const dlg = getDialog("install-dialog");
  dlg.innerHTML = "";
  const ios = typeof forceIos === "boolean" ? forceIos : isIOS();
  const steps = ios ? [
    "Diese Seite in Safari öffnen.",
    "Unten (am iPad oben) auf das Teilen-Symbol tippen: das Quadrat mit dem Pfeil nach oben.",
    "Nach unten scrollen und „Zum Home-Bildschirm“ wählen.",
    "Oben rechts auf „Hinzufügen“ tippen. Fertig – die Liga liegt jetzt als Icon auf dem Startbildschirm.",
  ] : [
    "Diese Seite in Chrome (oder Edge, Samsung Internet) öffnen.",
    "Oben rechts auf das Menü ⋮ tippen.",
    "„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.",
    "Bestätigen. Fertig – die Liga liegt jetzt als Icon auf dem Startbildschirm.",
  ];
  dlg.appendChild(el("div", { class: "pc" }, [
    el("div", { class: "pc-head" }, [
      el("h2", { text: "Als App installieren" }),
      el("button", { type: "button", class: "btn close", text: "✕", "aria-label": "Schließen", onclick: function () { dlg.close(); } }),
    ]),
    el("p", { class: "note", text: ios ? "Anleitung für iPhone und iPad:" : "Anleitung für Android:" }),
    el("ol", { class: "install-steps" }, steps.map(function (s) { return el("li", { text: s }); })),
    el("p", { class: "note", text: "Die App startet ohne Browserleiste, zeigt immer den aktuellen Stand und den zuletzt geladenen auch ohne Internet." }),
    el("button", { type: "button", class: "linkbtn", text: ios ? "Anleitung für Android anzeigen" : "Anleitung für iPhone anzeigen",
      onclick: function () { showInstallHelp(!ios); } }),
  ]));
  if (!dlg.open) dlg.showModal();
}

getDialog("install-dialog").addEventListener("click", function (e) {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
renderFooter();
