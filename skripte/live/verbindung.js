// =====================================================================
//  Live Scoring: Lesen und Schreiben über die Web-Schnittstelle (REST)
//  der Firebase Realtime Database – ohne Firebase-Bibliothek.
//    schreiben  PUT/DELETE  <db>/live/<schlüssel>.json
//    mithören   EventSource <db>/live.json  (Server-Sent Events)
//  Firebase schickt beim Verbinden den ganzen Stand („put“ auf „/“), danach
//  jede Änderung („put“ = ersetzen, „patch“ = Felder ergänzen). Bricht die
//  Verbindung ab, verbindet EventSource sich von selbst neu.
// =====================================================================
import { LIVE_DB } from "./konfig.js";

export function liveEnabled() {
  return !!LIVE_DB && typeof fetch === "function";
}

// Schlüssel eines Spiels, z. B. „s7-HF1“ (Firebase erlaubt kein . # $ [ ] /)
export function liveKey(nr, id) {
  return "s" + nr + "-" + String(id).replace(/[^A-Za-z0-9]/g, "");
}

function url(path) { return LIVE_DB.replace(/\/+$/, "") + "/" + path + ".json"; }

// Ergebnis: Promise<boolean> (true = angekommen)
export function putLive(key, value) {
  return fetch(url("live/" + key), { method: "PUT", body: JSON.stringify(value), keepalive: true })
    .then(function (r) { return r.ok; }, function () { return false; });
}

export function deleteLive(key) {
  return fetch(url("live/" + key), { method: "DELETE", keepalive: true })
    .then(function (r) { return r.ok; }, function () { return false; });
}

// Wert an einem Pfad wie „/s7-HF1/events“ im Baum setzen (null = löschen)
function setAt(tree, path, data, merge) {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) {
    if (merge) return Object.assign({}, tree || {}, data || {});
    return data;
  }
  const root = tree && typeof tree === "object" ? Object.assign({}, tree) : {};
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node[parts[i]];
    node[parts[i]] = next && typeof next === "object" ? (Array.isArray(next) ? next.slice() : Object.assign({}, next)) : {};
    node = node[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (merge) {
    const base = node[last] && typeof node[last] === "object" ? node[last] : {};
    node[last] = Object.assign({}, base);
    Object.keys(data || {}).forEach(function (k) {
      if (data[k] === null) delete node[last][k]; else node[last][k] = data[k];
    });
  } else if (data === null) delete node[last];
  else node[last] = data;
  return root;
}

// Mithören: onChange(alleLiveSpiele) bei jeder Änderung; Ergebnis: stop()
export function watchLive(onChange, onState) {
  if (!liveEnabled() || typeof EventSource === "undefined") return function () {};
  let tree = {};
  const es = new EventSource(url("live"));
  const handle = function (merge) {
    return function (ev) {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || typeof msg.path !== "string") return;
      tree = setAt(tree, msg.path, msg.data, merge) || {};
      onChange(tree);
    };
  };
  es.addEventListener("put", handle(false));
  es.addEventListener("patch", handle(true));
  es.addEventListener("open", function () { if (onState) onState(true); });
  es.addEventListener("error", function () { if (onState) onState(false); });
  return function () { es.close(); };
}
