// =====================================================================
//  Caller-Aufnahmen: abspielen, aufbereiten, auf dem Gerät speichern
//
//  Quellen eines Clips (in dieser Reihenfolge):
//    1. auf diesem Gerät aufgenommen (IndexedDB) – sofort nutzbar
//    2. hochgeladen (daten/caller.js -> daten/caller/<id>.wav)
//  Abgespielt wird über Web Audio, damit die Teile einer Ansage
//  („Kilian“ + „you require“ + „81“) ohne Pause aneinander passen.
// =====================================================================
import { geladen } from "../kern/daten.js";

let published = Object.assign({}, geladen.caller);   // id -> URL
const local = {};                                     // id -> { wav: ArrayBuffer, uploaded: bool }
const buffers = new Map();                            // Schlüssel -> AudioBuffer
let ctx = null;
let sources = [];

export function setPublished(map) { published = Object.assign({}, map); }

export function hasClip(id) { return !!(local[id] || published[id]); }
export function hasAllClips(ids) { return !!ids && ids.length > 0 && ids.every(hasClip); }
export function anyClips() { return Object.keys(local).length > 0 || Object.keys(published).length > 0; }
export function isLocal(id) { return !!local[id]; }
export function newLocalIds() { return Object.keys(local).filter(function (id) { return !local[id].uploaded; }); }
export function localWav(id) { return local[id] ? local[id].wav : null; }

export function audioAvailable() {
  return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
}

// Muss bei einer Berührung (Tippen) erstmals aufgerufen werden, sonst bleibt es am Handy stumm
export function audioContext() {
  if (!audioAvailable()) return null;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(function () {});
  return ctx;
}

function bufferKey(id) { return local[id] ? "local:" + id + ":" + local[id].wav.byteLength : "pub:" + published[id]; }

async function loadBuffer(id) {
  const key = bufferKey(id);
  if (buffers.has(key)) return buffers.get(key);
  const c = audioContext();
  let data;
  if (local[id]) data = local[id].wav.slice(0);
  else {
    const r = await fetch(published[id]);
    if (!r.ok) throw new Error("Clip " + id + " fehlt (" + r.status + ")");
    data = await r.arrayBuffer();
  }
  const buf = await c.decodeAudioData(data);
  buffers.set(key, buf);
  return buf;
}

// Im Hintergrund vorladen, damit die erste Ansage nicht hängt
export function preloadClips() {
  if (!audioAvailable() || !anyClips()) return;
  const ids = Object.keys(local).concat(Object.keys(published));
  (async function () {
    for (let i = 0; i < ids.length; i++) {
      try { await loadBuffer(ids[i]); } catch (e) { /* fehlt: Handy-Stimme springt ein */ }
    }
  })();
}

// Clips direkt hintereinander abspielen; Ergebnis: Promise, fertig wenn verklungen
export async function playClips(ids) {
  const c = audioContext();
  try { document.dispatchEvent(new CustomEvent("liga:caller", { detail: { type: "play", ids: ids.slice() } })); } catch (e) { /* egal */ }
  const bufs = [];
  for (let i = 0; i < ids.length; i++) bufs.push(await loadBuffer(ids[i]));
  let t = c.currentTime + 0.03;
  const gap = 0.05;
  return new Promise(function (resolve) {
    bufs.forEach(function (b, i) {
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start(t);
      sources.push(src);
      if (i === bufs.length - 1) src.onended = function () { resolve(); };
      t += b.duration + gap;
    });
    // Falls onended nicht kommt (z. B. gestoppt)
    setTimeout(resolve, (t - c.currentTime) * 1000 + 300);
  });
}

// Eine WAV direkt abspielen (Probehören einer frischen Aufnahme)
export async function playWav(wav) {
  const c = audioContext();
  stopClips();
  const buf = await c.decodeAudioData(wav.slice(0));
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
  sources.push(src);
  try { document.dispatchEvent(new CustomEvent("liga:caller", { detail: { type: "probe", seconds: buf.duration } })); } catch (e) { /* egal */ }
}

export function stopClips() {
  sources.forEach(function (s) { try { s.stop(); } catch (e) { /* schon fertig */ } });
  sources = [];
}

// ---------------------------------------------------------------------
//  Gerätespeicher (IndexedDB): Aufnahmen bleiben auch nach Neuladen
// ---------------------------------------------------------------------
const DB_NAME = "liga-caller";
const DB_STORE = "clips";

function openDb() {
  return new Promise(function (ok, fail) {
    if (typeof indexedDB === "undefined") { fail(new Error("Kein Gerätespeicher")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function () { req.result.createObjectStore(DB_STORE); };
    req.onsuccess = function () { ok(req.result); };
    req.onerror = function () { fail(req.error); };
  });
}

function tx(mode, fn) {
  return openDb().then(function (db) {
    return new Promise(function (ok, fail) {
      const t = db.transaction(DB_STORE, mode);
      const res = fn(t.objectStore(DB_STORE));
      t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : undefined); db.close(); };
      t.onerror = function () { fail(t.error); db.close(); };
    });
  });
}

export async function loadLocalClips() {
  try {
    const db = await openDb();
    await new Promise(function (ok) {
      const t = db.transaction(DB_STORE, "readonly");
      const req = t.objectStore(DB_STORE).openCursor();
      req.onsuccess = function () {
        const cur = req.result;
        if (!cur) return;
        local[cur.key] = cur.value;
        cur.continue();
      };
      t.oncomplete = function () { db.close(); ok(); };
      t.onerror = function () { db.close(); ok(); };
    });
  } catch (e) { /* nicht verfügbar */ }
}

export async function saveLocalClip(id, wav) {
  local[id] = { wav: wav, uploaded: false };
  try { await tx("readwrite", function (s) { return s.put(local[id], id); }); } catch (e) { /* bleibt bis zum Neuladen */ }
}

export async function markUploaded(ids) {
  for (let i = 0; i < ids.length; i++) {
    if (!local[ids[i]]) continue;
    local[ids[i]].uploaded = true;
    try { await tx("readwrite", function (s) { return s.put(local[ids[i]], ids[i]); }); } catch (e) { /* egal */ }
  }
}

export async function deleteLocalClips(ids) {
  for (let i = 0; i < ids.length; i++) {
    delete local[ids[i]];
    try { await tx("readwrite", function (s) { return s.delete(ids[i]); }); } catch (e) { /* egal */ }
  }
}

// ---------------------------------------------------------------------
//  Aufnahme aufbereiten: Mono, Stille vorn/hinten weg, Lautstärke angleichen,
//  24 kHz, als WAV (spielt jedes Handy ab, auch iPhone)
// ---------------------------------------------------------------------
const RATE = 24000;

export async function processRecording(blob) {
  const c = audioContext();
  const decoded = await c.decodeAudioData(await blob.arrayBuffer());
  // Mono
  const n = decoded.length, chans = decoded.numberOfChannels;
  const mono = new Float32Array(n);
  for (let ch = 0; ch < chans; ch++) {
    const d = decoded.getChannelData(ch);
    for (let i = 0; i < n; i++) mono[i] += d[i] / chans;
  }
  // Stille abschneiden
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mono[i]));
  if (peak < 0.01) throw new Error("Nichts zu hören. Näher ans Mikrofon und noch einmal.");
  const thr = Math.max(0.01, peak * 0.08);
  let a = 0, b = n - 1;
  while (a < n && Math.abs(mono[a]) < thr) a++;
  while (b > a && Math.abs(mono[b]) < thr) b--;
  const sr = decoded.sampleRate;
  a = Math.max(0, a - Math.round(0.04 * sr));
  b = Math.min(n - 1, b + Math.round(0.15 * sr));
  const cut = mono.slice(a, b + 1);
  // Lautstärke angleichen, kurz ein- und ausblenden (kein Knacken)
  const gain = Math.min(10, 0.89 / peak);
  const fade = Math.round(0.006 * sr);
  for (let i = 0; i < cut.length; i++) {
    let g = gain;
    if (i < fade) g *= i / fade;
    if (i > cut.length - fade) g *= (cut.length - i) / fade;
    cut[i] *= g;
  }
  // Auf 24 kHz umrechnen
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const outLen = Math.max(1, Math.round(cut.length * RATE / sr));
  const off = new Off(1, outLen, RATE);
  const src = off.createBuffer(1, cut.length, sr);
  src.getChannelData(0).set(cut);
  const node = off.createBufferSource();
  node.buffer = src;
  node.connect(off.destination);
  node.start();
  const rendered = await off.startRendering();
  return encodeWav(rendered.getChannelData(0), RATE);
}

export function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = function (o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return buf;
}
