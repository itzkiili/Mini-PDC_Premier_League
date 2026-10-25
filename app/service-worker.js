// =====================================================================
//  Liga-Seite – Service Worker (macht die Seite als App installierbar
//  und hält den letzten Stand für die Nutzung ohne Internet bereit)
//
//  Strategie: immer zuerst aus dem Netz laden (damit Ergebnisse sofort
//  aktuell sind); nur ohne Verbindung wird die gespeicherte Fassung gezeigt.
//  Nach größeren Änderungen CACHE_VERSION hochzählen.
// =====================================================================
const CACHE_VERSION = "liga-v5";

const CORE = [
  "./",
  "index.html",
  "daten/ergebnisse.js",
  "daten/zugang.js",
  "daten/saisons.js",
  "css/style.css",
  "skripte/1-daten.js",
  "skripte/2-auswertung.js",
  "skripte/3-anzeige.js",
  "skripte/4-spielerkarte.js",
  "skripte/5-eingabe.js",
  "skripte/6-speichern.js",
  "skripte/7-start.js",
  "skripte/8-app.js",
  "skripte/9-darstellung.js",
  "skripte/10-saisons.js",
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

  // Schriften von Google: einmal laden, dann aus dem Speicher
     if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "cdnjs.cloudflare.com") {    event.respondWith(
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

  // Eigene Dateien: Netz zuerst, bei Erfolg Speicher aktualisieren, offline aus dem Speicher
  event.respondWith(
    fetch(req).then(function (res) {
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
