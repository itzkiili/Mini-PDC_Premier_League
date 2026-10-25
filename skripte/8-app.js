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
  openDialog(dlg);
}

getDialog("install-dialog").addEventListener("click", function (e) {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
renderFooter();


// ---------------------------------------------------------------------
//  Regelwerk (PDF) in der App
//  In der installierten App gibt es keinen Zurück-Knopf. Deshalb öffnet
//  das PDF dort in einem eigenen Fenster mit „← Zurück“. Im normalen
//  Browser bleibt alles wie bisher (neuer Tab).
// ---------------------------------------------------------------------
const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfjsLoading = null;
let pdfHistory = false;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsLoading) {
    pdfjsLoading = new Promise(function (ok, fail) {
      const s = document.createElement("script");
      s.src = PDFJS_BASE + "pdf.min.js";
      s.onload = function () {
        if (!window.pdfjsLib) { fail(new Error("pdf.js fehlt")); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + "pdf.worker.min.js";
        ok(window.pdfjsLib);
      };
      s.onerror = function () { pdfjsLoading = null; fail(new Error("pdf.js konnte nicht geladen werden")); };
      document.head.appendChild(s);
    });
  }
  return pdfjsLoading;
}

function openRulesViewer(href) {
  const url = new URL(href, location.href).href;
  const dlg = getDialog("pdf-dialog");
  if (!dlg.dataset.ready) {
    dlg.dataset.ready = "1";
    dlg.setAttribute("aria-label", "Regelwerk");
    // Schließen (Knopf, Esc): den zusätzlichen Verlaufseintrag wieder entfernen
    dlg.addEventListener("close", function () {
      if (pdfHistory) { pdfHistory = false; history.back(); }
    });
  }
  dlg.innerHTML = "";
  const pages = el("div", { class: "pdf-pages" }, [el("p", { class: "note", text: "Regelwerk wird geladen …" })]);
  dlg.appendChild(el("div", { class: "pdf-bar" }, [
    el("button", { type: "button", class: "btn", text: "← Zurück", onclick: function () { dlg.close(); } }),
    el("span", { class: "pdf-title", text: "Regelwerk" }),
    navigator.share ? el("button", { type: "button", class: "linkbtn pdf-share", text: "Teilen / Sichern",
      onclick: function () { navigator.share({ title: "Regelwerk", url: url }).catch(function () {}); } }) : null,
  ]));
  dlg.appendChild(pages);
  openDialog(dlg);
  // Zurück-Geste (Android) schließt das Fenster statt die App
  if (!pdfHistory) { try { history.pushState({ pdf: true }, ""); pdfHistory = true; } catch (e) { /* egal */ } }

  loadPdfJs().then(function (lib) {
    return lib.getDocument(url).promise;
  }).then(function (pdf) {
    pages.innerHTML = "";
    const width = Math.min(pages.clientWidth - 24, 900);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let chain = Promise.resolve();
    for (let n = 1; n <= pdf.numPages; n++) {
      chain = chain.then(function () {
        if (!dlg.open) return null;
        return pdf.getPage(n).then(function (page) {
          const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width * dpr });
          const c = el("canvas", { class: "pdf-page", width: Math.floor(vp.width), height: Math.floor(vp.height),
            role: "img", "aria-label": "Seite " + n });
          pages.appendChild(c);
          return page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        });
      });
    }
    return chain;
  }).catch(function () {
    pages.innerHTML = "";
    pages.appendChild(el("p", { class: "note", text: "Das Regelwerk konnte nicht angezeigt werden. Ohne Internet klappt es erst, wenn es einmal mit Verbindung geöffnet wurde." }));
  });
}

window.addEventListener("popstate", function () {
  const dlg = document.getElementById("pdf-dialog");
  if (dlg && dlg.open) { pdfHistory = false; dlg.close(); }
});

document.addEventListener("click", function (e) {
  const a = e.target.closest ? e.target.closest("a.pdf-link") : null;
  if (!a || !isStandalone()) return;
  e.preventDefault();
  openRulesViewer(a.getAttribute("href"));
});
