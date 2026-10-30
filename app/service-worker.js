// =====================================================================
//  Liga-Seite – Service Worker (macht die Seite als App installierbar
//  und hält den letzten Stand für die Nutzung ohne Internet bereit)
//
//  Strategie: immer zuerst aus dem Netz laden (damit Ergebnisse sofort
//  aktuell sind); nur ohne Verbindung wird die gespeicherte Fassung gezeigt.
//  Nach Änderungen an der Dateiliste CACHE_VERSION hochzählen.
// =====================================================================
const CACHE_VERSION = "liga-v8";

// Für die Nutzung ohne Internet vorab gespeichert.
// Neue Datei in skripte/? Hier eintragen (werkzeuge/pruefen.mjs meldet fehlende).
const CORE = [
  "./",
  "index.html",
  "daten/ergebnisse.js",
  "daten/zugang.js",
  "daten/saisons.js",
  "daten/spieler.js",
  "css/style.css",
  "skripte/main.js",
  "skripte/anzeige/erfolge.js",
  "skripte/anzeige/fusszeile.js",
  "skripte/anzeige/naechstes-spiel.js",
  "skripte/anzeige/navigation.js",
  "skripte/anzeige/profil.js",
  "skripte/anzeige/saisonauswahl.js",
  "skripte/anzeige/saisonfinale.js",
  "skripte/anzeige/seite.js",
  "skripte/anzeige/spielerkarte.js",
  "skripte/anzeige/spieltag.js",
  "skripte/anzeige/tabelle.js",
  "skripte/anzeige/vergleich.js",
  "skripte/anzeige/weltrangliste.js",
  "skripte/app/aktualisieren.js",
  "skripte/app/design.js",
  "skripte/app/installieren.js",
  "skripte/app/regelwerk.js",
  "skripte/auswertung/elo.js",
  "skripte/auswertung/erfolge.js",
  "skripte/auswertung/modus.js",
  "skripte/auswertung/spieltag.js",
  "skripte/auswertung/statistik.js",
  "skripte/auswertung/tabelle.js",
  "skripte/bearbeiten/anmeldung.js",
  "skripte/bearbeiten/datei.js",
  "skripte/bearbeiten/eingabe.js",
  "skripte/bearbeiten/github.js",
  "skripte/bearbeiten/leiste.js",
  "skripte/bearbeiten/profil-editor.js",
  "skripte/bearbeiten/saisonwechsel.js",
  "skripte/bearbeiten/speichern.js",
  "skripte/bearbeiten/verschluesselung.js",
  "skripte/bearbeiten/zusammenfuehren.js",
  "skripte/kern/daten.js",
  "skripte/kern/dom.js",
  "skripte/kern/hilfen.js",
  "skripte/kern/konstanten.js",
  "skripte/kern/zustand.js",
  "dokumente/Regelwerk.pdf",
  "app/manifest.webmanifest",
  "app/icons/icon-192.png",
  "app/icons/icon-512.png",
  "app/icons/apple-touch-icon.png",
  "app/icons/favicon-32.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // Einzeln laden, damit eine fehlende Datei (z. B. zugang.js) nicht alles abbricht
      return Promise.all(CORE.map(function (url) {
        return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // GitHub-Schnittstelle (Bearbeiten-Modus) nie zwischenspeichern
  if (url.hostname === "api.github.com") return;

  // Schriften von Google und pdf.js: einmal laden, dann aus dem Speicher
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "cdnjs.cloudflare.com") {
    event.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Eigene Dateien immer beim Server nachfragen, nicht aus dem Browser-Zwischenspeicher:
  // Ergebnisse sind so sofort aktuell, und nach einem Update passen alle
  // Programmdateien (skripte/) zusammen. Unveränderte Dateien kosten dabei
  // nur eine kurze Rückfrage (304). Seitenaufrufe selbst bleiben unverändert.
  const fresh = req.mode === "navigate" ? req : new Request(req, { cache: "no-cache" });

  // Eigene Dateien: Netz zuerst, bei Erfolg Speicher aktualisieren, offline aus dem Speicher
  event.respondWith(
    fetch(fresh).then(function (res) {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("index.html");
        return new Response("", { status: 504, statusText: "Offline" });
      });
    })
  );
});
