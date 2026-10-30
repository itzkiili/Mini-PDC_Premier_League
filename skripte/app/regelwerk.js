// =====================================================================
//  Regelwerk (PDF) in der installierten App
//  In der App gibt es keinen Zurück-Knopf. Deshalb öffnet das PDF dort in
//  einem eigenen Fenster mit „← Zurück“. Im normalen Browser bleibt alles
//  wie gehabt (neuer Tab).
// =====================================================================
import { el, getDialog, openDialog } from "../kern/dom.js";
import { isStandalone } from "./installieren.js";

const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfjsLoading = null;
let pdfHistory = false;   // zusätzlicher Verlaufseintrag für die Zurück-Geste

export function initRulesViewer() {
  // Zurück-Geste (Android) schließt das Fenster statt die App
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
}

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
  if (!pdfHistory) { try { history.pushState({ pdf: true }, ""); pdfHistory = true; } catch (e) { /* egal */ } }

  // Seiten nacheinander als Bild zeichnen
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
