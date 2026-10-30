// =====================================================================
//  Schnelle Prüfung vor dem Hochladen (braucht Node.js 18 oder neuer):
//      node werkzeuge/pruefen.mjs
//
//  - Jede Datei in skripte/ steht in der Offline-Liste des Service Workers
//    (sonst fehlt sie in der App ohne Internet) – und umgekehrt.
//  - Jeder Import findet seine Datei und den importierten Namen.
//  - Jede Datei ist gültiges JavaScript.
// =====================================================================
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, normalize } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function walk(dir) {
  return readdirSync(dir).flatMap(function (name) {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith(".js") ? [p] : []);
  });
}
const rel = function (p) { return relative(root, p).split("\\").join("/"); };
const modules = walk(join(root, "skripte"));

// 1. Offline-Liste
const sw = readFileSync(join(root, "app/service-worker.js"), "utf8");
const core = [...sw.matchAll(/^\s*"([^"]+)",$/gm)].map(function (m) { return m[1]; });
modules.map(rel).forEach(function (f) {
  if (core.indexOf(f) < 0) problems.push("Fehlt in app/service-worker.js (CORE): " + f);
});
core.forEach(function (f) {
  if (f !== "./" && !existsSync(join(root, f))) problems.push("In app/service-worker.js eingetragen, aber nicht vorhanden: " + f);
});

// 2. Importe und Exporte
const exportsOf = {};
modules.forEach(function (f) {
  const text = readFileSync(f, "utf8");
  exportsOf[normalize(f)] = new Set([...text.matchAll(/export (?:async )?(?:function|const|let) (\w+)/g)].map(function (m) { return m[1]; }));
});
modules.forEach(function (f) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/import \{([^}]+)\} from "([^"]+)"/g)) {
    const target = normalize(join(dirname(f), m[2]));
    if (!exportsOf[target]) { problems.push(rel(f) + ": Datei nicht gefunden: " + m[2]); continue; }
    m[1].split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (name) {
      if (!exportsOf[target].has(name)) problems.push(rel(f) + ": „" + name + "“ wird von " + m[2] + " nicht exportiert");
    });
  }
});

// 3. Syntax
modules.forEach(function (f) {
  const r = spawnSync(process.execPath, ["--check", "--input-type=module"], { input: readFileSync(f) });
  if (r.status !== 0) problems.push(rel(f) + ": " + String(r.stderr).split("\n").slice(0, 5).join(" "));
});

if (problems.length) {
  console.log("✗ " + problems.length + " Problem(e):\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("✓ " + modules.length + " Dateien geprüft, alles in Ordnung.");
