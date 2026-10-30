// =====================================================================
//  Kleine Hilfsfunktionen ohne Bezug zur Seite
// =====================================================================

export function clone(x) { return JSON.parse(JSON.stringify(x)); }

// Name säubern: leere Einträge werden zu null
export function clean(n) {
  if (n === null || n === undefined) return null;
  const s = String(n).trim();
  return s === "" ? null : s;
}

// Zahl aus einer Eingabe („47,5“ oder 47.5), sonst null
export function toNum(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).trim().replace(",", "."));
  return isFinite(n) ? n : null;
}

export function fmtAvg(n) { return n === null || n === undefined ? "–" : n.toFixed(2).replace(".", ","); }
export function pct(a, b) { return b ? Math.round((a / b) * 100) + " %" : "–"; }
export function plural(n, eins, mehr) { return n + " " + (n === 1 ? eins : mehr); }

// "Liga 2025/26" -> "25/26"
export function shortSeason(name) {
  const m = String(name || "").match(/(\d{4})\s*[\/\-–]\s*(\d{2,4})/);
  return m ? m[1].slice(-2) + "/" + m[2].slice(-2) : String(name || "");
}

// ---------- Speicher des Geräts (localStorage) ----------
export function store(key, val) {
  try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (e) { /* nicht verfügbar */ }
}
export function load(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

// ---------- Base64 ----------
export function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64ToBytes(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
export function b64encode(text) { return bytesToB64(new TextEncoder().encode(text)); }
export function b64decode(b64) { return new TextDecoder("utf-8").decode(b64ToBytes(b64)); }
