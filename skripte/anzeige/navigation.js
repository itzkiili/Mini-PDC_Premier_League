// =====================================================================
//  Welcher Spieltag wird geöffnet? Links auf einzelne Spieltage (#spieltag-3)
//  Reihenfolge: 1. Link mit #spieltag-3  2. festgelegter aktueller Spieltag
//  (LIGA.aktuell)  3. neuester Spieltag
// =====================================================================
import { state } from "../kern/zustand.js";

export function dayNr(d, idx) { return d.nr != null ? d.nr : idx + 1; }

export function dayIdxByNr(nr) {
  for (let i = 0; i < state.days.length; i++) if (Number(state.days[i].nr) === Number(nr)) return i;
  return -1;
}

export function hashDayNr() {
  const m = /^#spieltag-(\d+)$/i.exec(location.hash);
  return m ? Number(m[1]) : null;
}

export function startDayIdx() {
  const h = hashDayNr();
  if (h !== null && dayIdxByNr(h) >= 0) return dayIdxByNr(h);
  if (state.liga.aktuell != null && dayIdxByNr(state.liga.aktuell) >= 0) return dayIdxByNr(state.liga.aktuell);
  return state.days.length - 1;
}

export function isPinnedDay(nr) {
  return state.liga.aktuell != null && Number(state.liga.aktuell) === Number(nr);
}

export function setDayHash(nr) {
  try { history.replaceState(null, "", "#spieltag-" + nr); } catch (e) { /* egal */ }
}

function dayLink(nr) {
  return location.origin + location.pathname + location.search + "#spieltag-" + nr;
}

export function shareDayLink(nr, btn) {
  const url = dayLink(nr);
  if (navigator.share) {
    navigator.share({ title: (state.liga.name || "Liga") + " – Spieltag " + nr, url: url }).catch(function () {});
    return;
  }
  const done = function () {
    btn.textContent = "Link kopiert ✓";
    setTimeout(function () { btn.textContent = "🔗 Link"; }, 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, function () { prompt("Link zum Kopieren:", url); });
  } else {
    prompt("Link zum Kopieren:", url);
  }
}

// Zum Abschnitt „Spieltage“ springen
export function scrollToDays() {
  const sec = document.getElementById("spieltage");
  if (sec) sec.scrollIntoView();
}
