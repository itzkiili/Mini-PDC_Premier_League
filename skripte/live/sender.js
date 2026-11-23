// =====================================================================
//  Live Scoring: der Zähler überträgt das laufende Spiel
//  Nach jeder Änderung (saveCur) wird das ganze Spiel geschrieben – nur
//  die Liste der Aufnahmen, die Zuschauer rechnen den Rest selbst aus.
//  Ist das Spiel übernommen oder verworfen, wird der Eintrag gelöscht.
//  Pro Gerät abschaltbar (Menü im Zähler); ohne LIVE_DB ist alles aus.
// =====================================================================
import { load, store } from "../kern/hilfen.js";
import { liveEnabled, liveKey, putLive, deleteLive } from "./verbindung.js";

const SETTING = "liga.live";      // "aus" = auf diesem Gerät nicht übertragen
const LAST = "liga.liveKey";      // zuletzt übertragenes Spiel (zum Aufräumen)

export function liveSendOn() { return liveEnabled() && load(SETTING) !== "aus"; }
export function setLiveSend(on) { store(SETTING, on ? null : "aus"); }

// Zustand für die Anzeige im Zähler: "aus", "sendet", "ok", "fehler"
let status = "aus";
let onStatus = null;
export function liveStatus() { return status; }
export function onLiveStatus(fn) { onStatus = fn; }
function setStatus(s) { if (s !== status) { status = s; if (onStatus) onStatus(s); } }

// Immer nur eine Anfrage gleichzeitig; kommt währenddessen eine neue
// Aufnahme, wird danach nur der neueste Stand geschickt.
let busy = false, next = null;
function send(job) {
  if (busy) { next = job; return; }
  busy = true;
  setStatus(status === "ok" ? "ok" : "sendet");
  const p = job.value ? putLive(job.key, job.value) : deleteLive(job.key);
  p.then(function (ok) {
    busy = false;
    if (job.value) setStatus(ok ? "ok" : "fehler");
    const n = next; next = null;
    if (n) send(n);
  });
}

// cur: laufendes Spiel des Zählers (oder null)
export function syncLive(cur) {
  const last = load(LAST);
  const key = liveSendOn() && cur && cur.match ? liveKey(cur.nr, cur.id) : null;
  if (last && last !== key) send({ key: last, value: null });   // altes Spiel nicht mehr live
  store(LAST, key);
  if (!key) { setStatus("aus"); return; }
  send({ key: key, value: {
    liga: cur.liga || "", nr: cur.nr, id: cur.id, players: cur.players,
    format: cur.match.format, starter: cur.match.starter, events: cur.match.events,
    updated: { ".sv": "timestamp" },   // Zeit des Firebase-Servers
  } });
}
