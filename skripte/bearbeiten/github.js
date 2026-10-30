// =====================================================================
//  GitHub-Schnittstelle: Dateien lesen und schreiben
//  https://docs.github.com/rest/repos/contents
// =====================================================================
import { b64encode, b64decode } from "../kern/hilfen.js";
import { gh } from "../kern/zustand.js";

function apiHeaders() {
  return {
    "Authorization": "Bearer " + gh.token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function contentsUrl(path) {
  return "https://api.github.com/repos/" + gh.repo + "/contents/" + path;
}

// Datei holen. Ergebnis: Antwort von fetch (ok, status, json()).
export function getFile(path, branch) {
  return fetch(contentsUrl(path) + "?ref=" + encodeURIComponent(branch || gh.branch), { headers: apiHeaders(), cache: "no-store" });
}

// Datei holen und als Text liefern: { text, sha }, oder null wenn es sie nicht gibt
export async function readFile(path) {
  const r = await getFile(path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Die Datei " + path + " konnte nicht geladen werden (Fehler " + r.status + ").");
  const j = await r.json();
  return { text: b64decode(j.content), sha: j.sha };
}

function writeError(status) {
  if (status === 401) return new Error("Der Token ist ungültig oder abgelaufen.");
  if (status === 403 || status === 404) return new Error("Der Token darf in dieses Repository nicht schreiben (Berechtigung „Contents: Read and write“ nötig).");
  return new Error("GitHub antwortet mit Fehler " + status + ".");
}

// ---------------------------------------------------------------------
//  Datei schreiben (Inhalt bereits Base64)
//  sha: Stand, auf dem die Änderung beruht. Ohne sha wird der aktuelle
//  Stand vorher geholt (die Datei wird dann einfach ersetzt).
//  Ergebnis: neuer sha, oder null, wenn inzwischen jemand anderes
//  gespeichert hat (409/422) – dann zusammenführen und erneut versuchen.
// ---------------------------------------------------------------------
export async function putContent(path, base64, message, sha) {
  if (sha === undefined) {
    const g = await getFile(path);
    if (g.ok) sha = (await g.json()).sha;
    else if (g.status !== 404) throw new Error("GitHub antwortet mit Fehler " + g.status + ".");
    else sha = null;
  }
  const body = { message: message, content: base64, branch: gh.branch };
  if (sha) body.sha = sha;
  const r = await fetch(contentsUrl(path), { method: "PUT", headers: apiHeaders(), body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) return null;
  if (!r.ok) throw writeError(r.status);
  const j = await r.json().catch(function () { return null; });
  return (j && j.content && j.content.sha) || "";
}

// Textdatei anlegen oder ersetzen; Fehler bei gleichzeitiger Änderung
export async function putFile(path, text, message) {
  const sha = await putContent(path, b64encode(text), message);
  if (sha === null) throw writeError(409);
  return sha;
}
