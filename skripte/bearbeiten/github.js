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

// ---------------------------------------------------------------------
//  Viele Dateien in einem einzigen Commit (Git-API: Blobs, Tree, Commit)
//  files: [{ path, base64 }]; onProgress(fertig, gesamt) optional
//  Hat inzwischen jemand anderes gespeichert, wird auf dessen Stand neu
//  aufgesetzt (die eigenen Dateien ersetzen nur die gleichen Pfade).
// ---------------------------------------------------------------------
async function api(method, path, body) {
  const r = await fetch("https://api.github.com/repos/" + gh.repo + "/git/" + path, {
    method: method, headers: apiHeaders(), body: body ? JSON.stringify(body) : undefined, cache: "no-store",
  });
  if (r.status === 401) throw new Error("Der Token ist ungültig oder abgelaufen.");
  if (r.status === 403 || r.status === 404) throw new Error("Der Token darf in dieses Repository nicht schreiben (Berechtigung „Contents: Read and write“ nötig).");
  return r;
}

export async function commitFiles(files, message, onProgress) {
  // 1. Inhalte hochladen (je Datei ein Blob, vier gleichzeitig)
  const blobs = new Array(files.length);
  let done = 0, next = 0;
  async function worker() {
    while (next < files.length) {
      const i = next++;
      const r = await api("POST", "blobs", { content: files[i].base64, encoding: "base64" });
      if (!r.ok) throw new Error("Hochladen fehlgeschlagen (Fehler " + r.status + ").");
      blobs[i] = (await r.json()).sha;
      done++;
      if (onProgress) onProgress(done, files.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  // 2. Commit auf den aktuellen Stand setzen
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await api("GET", "ref/heads/" + encodeURIComponent(gh.branch));
    if (!ref.ok) throw new Error("Branch nicht gefunden (Fehler " + ref.status + ").");
    const head = (await ref.json()).object.sha;
    const commit = await (await api("GET", "commits/" + head)).json();
    const tree = await api("POST", "trees", {
      base_tree: commit.tree.sha,
      tree: files.map(function (f, i) { return { path: f.path, mode: "100644", type: "blob", sha: blobs[i] }; }),
    });
    if (!tree.ok) throw new Error("Hochladen fehlgeschlagen (Fehler " + tree.status + ").");
    const created = await api("POST", "commits", { message: message, tree: (await tree.json()).sha, parents: [head] });
    if (!created.ok) throw new Error("Hochladen fehlgeschlagen (Fehler " + created.status + ").");
    const sha = (await created.json()).sha;
    const upd = await api("PATCH", "refs/heads/" + encodeURIComponent(gh.branch), { sha: sha });
    if (upd.ok) return sha;
    if (upd.status !== 422 && upd.status !== 409) throw new Error("Hochladen fehlgeschlagen (Fehler " + upd.status + ").");
    // inzwischen hat jemand gespeichert: neu aufsetzen
  }
  throw new Error("Hochladen ist mehrmals mit anderen Änderungen zusammengestoßen. Bitte noch einmal versuchen.");
}
