// =====================================================================
//  Zugang mit Passwort
//  Der GitHub-Token liegt verschlüsselt in daten/zugang.js
//  (AES-256-GCM, Schlüssel per PBKDF2 aus dem Passwort abgeleitet).
// =====================================================================
import { bytesToB64, b64ToBytes } from "../kern/hilfen.js";
import { geladen } from "../kern/daten.js";

const PBKDF2_ITER = 600000;

// Inhalt von zugang.js (oder null)
export function access() {
  const z = geladen.zugang;
  return z && z.data && z.salt && z.iv ? z : null;
}

export function cryptoReady() {
  return !!(window.crypto && window.crypto.subtle);
}

async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token, password, repo, branch) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITER);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(JSON.stringify({ token: token })));
  return { v: 1, repo: repo, branch: branch, iter: PBKDF2_ITER, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptToken(z, password) {
  const key = await deriveKey(password, b64ToBytes(z.salt), Number(z.iter) || PBKDF2_ITER);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(z.iv) }, key, b64ToBytes(z.data));
  } catch (e) {
    throw new Error("Falsches Passwort.");
  }
  return JSON.parse(new TextDecoder().decode(pt)).token;
}

// Neuer Inhalt für daten/zugang.js
export function accessFileText(z) {
  return [
    "// =====================================================================",
    "//  ZUGANG für „Ergebnisse bearbeiten“",
    "// =====================================================================",
    "//  Enthält den GitHub-Token, verschlüsselt mit dem Bearbeiten-Passwort",
    "//  (AES-256-GCM, Schlüssel per PBKDF2 aus dem Passwort abgeleitet).",
    "//  Ohne das Passwort ist der Token nicht lesbar.",
    "//  Nicht von Hand ändern. Neu erzeugen über „Zugang neu einrichten“.",
    "// =====================================================================",
    "",
    "const ZUGANG = " + JSON.stringify(z, null, 2) + ";",
    "",
  ].join("\n");
}
