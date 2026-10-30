// =====================================================================
//  Gleichzeitiges Bearbeiten: Änderungen zusammenführen
//  Hat jemand anderes inzwischen gespeichert, wird dessen Stand mit den
//  eigenen Änderungen zusammengeführt. Nur wenn beide denselben Eintrag
//  unterschiedlich geändert haben, gibt es einen Konflikt.
//  Reine Berechnung, ohne Zugriff auf die Seite oder GitHub.
// =====================================================================
import { LABELS } from "../kern/konstanten.js";
import { clone } from "../kern/hilfen.js";
import { state } from "../kern/zustand.js";

const MERGE_GROUPS = ["sieger", "ergebnisse", "statistik", "bonus", "stechen"];

// Aktueller Stand zum Vergleichen
export function snapshot() { return { liga: clone(state.liga), days: clone(state.days) }; }

// Daten in einzelne Einträge zerlegen: "tag|4|ergebnisse|VF1" -> Wert (als JSON)
export function flattenData(data) {
  const out = {};
  const put = function (k, v) { if (v !== undefined) out[k] = JSON.stringify(v); };
  const liga = data.liga || {};
  // „stand“ wird bei jedem Speichern neu gesetzt und nicht zusammengeführt
  Object.keys(liga).forEach(function (k) { if (k !== "stand") put("liga|" + k, liga[k]); });
  (data.days || []).forEach(function (d) {
    const p = "tag|" + d.nr + "|";
    put(p + "da", true);
    Object.keys(d).forEach(function (k) {
      if (k === "nr") return;
      const v = d[k];
      if (MERGE_GROUPS.indexOf(k) >= 0 && v && typeof v === "object" && !Array.isArray(v)) {
        Object.keys(v).forEach(function (sub) { put(p + k + "|" + sub, v[sub]); });
      } else {
        put(p + k, v);
      }
    });
  });
  return out;
}

// Umkehrung von flattenData
export function unflattenData(flat) {
  const liga = {}, days = {};
  Object.keys(flat).forEach(function (key) {
    const v = JSON.parse(flat[key]);
    const parts = key.split("|");
    if (parts[0] === "liga") { liga[parts[1]] = v; return; }
    const nr = parts[1];
    const d = days[nr] || (days[nr] = {});
    if (parts.length === 3) d[parts[2]] = v;
    else { d[parts[2]] = d[parts[2]] || {}; d[parts[2]][parts.slice(3).join("|")] = v; }
  });
  const list = Object.keys(days).filter(function (nr) { return days[nr].da; }).map(function (nr) {
    const d = days[nr];
    const o = { nr: Number(nr) };
    ["datum", "spieler", "sieger"].concat(Object.keys(d)).forEach(function (k) {
      if (k !== "da" && d[k] !== undefined && !(k in o)) o[k] = d[k];
    });
    if (!o.sieger) o.sieger = {};
    return o;
  }).sort(function (a, b) { return a.nr - b.nr; });
  return { liga: liga, days: list };
}

// Verständlicher Name eines Eintrags für die Rückfrage bei Konflikten
export function conflictLabel(key) {
  const parts = key.split("|");
  if (parts[0] === "liga") return parts[1] === "stechen" ? "Entscheidungsleg der Gesamttabelle" : "Liga-Einstellung „" + parts[1] + "“";
  const names = { da: "Spieltag angelegt/gelöscht", datum: "Datum", spieler: "Spielerliste", sieger: "Sieger",
    ergebnisse: "Legs", statistik: "Average/Doppel", bonus: "Bonuswerte", stechen: "Stechen" };
  let t = "Spieltag " + parts[1] + " · " + (names[parts[2]] || parts[2]);
  if (parts[3]) t += " · " + (LABELS[parts[3]] || parts[3]);
  return t;
}

// ---------------------------------------------------------------------
//  Drei-Wege-Zusammenführung
//  base: zuletzt geladen, local: eigene Version, remote: Version auf GitHub
//  Ergebnis: { merged (flach), conflicts: [{ key, local, remote }], R }
//  Bei Konflikten steht zunächst die eigene Version in merged.
// ---------------------------------------------------------------------
export function mergeData(base, local, remote) {
  // Beide haben gleichzeitig einen neuen Spieltag mit derselben Nummer angelegt:
  // die eigene Fassung bekommt die nächste freie Nummer.
  local = clone(local);
  const baseNrs = (base.days || []).map(function (d) { return d.nr; });
  const remoteNrs = (remote.days || []).map(function (d) { return d.nr; });
  local.days.forEach(function (d) {
    if (baseNrs.indexOf(d.nr) < 0 && remoteNrs.indexOf(d.nr) >= 0) {
      const r = remote.days.filter(function (x) { return x.nr === d.nr; })[0];
      if (JSON.stringify(r) !== JSON.stringify(d)) {
        const all = remoteNrs.concat(local.days.map(function (x) { return x.nr; }));
        d.nr = Math.max.apply(null, all) + 1;
      }
    }
  });
  const B = flattenData(base), L = flattenData(local), R = flattenData(remote);
  const keys = {};
  [B, L, R].forEach(function (o) { Object.keys(o).forEach(function (k) { keys[k] = true; }); });
  const merged = {}, conflicts = [];
  Object.keys(keys).forEach(function (k) {
    const b = B[k], l = L[k], r = R[k];
    let v;
    if (l === r) v = l;
    else if (l === b) v = r;           // nur die andere Person hat geändert
    else if (r === b) v = l;           // nur ich habe geändert
    else { conflicts.push({ key: k, local: l, remote: r }); v = l; }
    if (v !== undefined) merged[k] = v;
  });
  return { merged: merged, conflicts: conflicts, R: R };
}
