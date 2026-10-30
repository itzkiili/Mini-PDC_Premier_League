// =====================================================================
//  Erfolge anzeigen: Abzeichen in der Spielerkarte und „🎉 Neu“ am Spieltag
//  Berechnung und Grenzwerte: auswertung/erfolge.js
// =====================================================================
import { el } from "../kern/dom.js";
import { shortSeason } from "../kern/hilfen.js";
import { render } from "../kern/zustand.js";
import { ERFOLGE, STUFEN, STUFEN_ICON, computeAchievements, achLevel } from "../auswertung/erfolge.js";
import { nameBtn } from "./spielerkarte.js";

let achDayOpen = null;   // Spieltag, dessen Erfolgsmeldungen aufgeklappt sind

function achWhen(g) {
  return (g.current ? "" : shortSeason(g.season) + " · ") + "Spieltag " + g.nr + (g.datum ? " · " + g.datum : "");
}

// Abschnitt „Erfolge“ in der Spielerkarte
export function achievementsSection(name) {
  const a = computeAchievements();
  const got = a.got[name] || {};
  const cnt = a.count[name] || {};
  let total = 0, max = 0;
  ERFOLGE.forEach(function (e) { total += achLevel(got[e.id]); max += e.stufen.length; });
  return el("div", null, [
    el("h3", { text: "Erfolge · " + total + " von " + max + " Stufen" }),
    el("div", { class: "ach-row" }, ERFOLGE.map(function (e) {
      const st = got[e.id] || [];
      const lvl = achLevel(st);
      // Nur eine Stufe zeigen: die höchste erreichte, sonst die Bronze-Bedingung
      const i = Math.max(lvl - 1, 0), g = st[i];
      let txt = STUFEN_ICON[i] + " " + e.text(e.stufen[i]);
      if (g) txt += " ✓ " + (g.detail ? g.detail + " · " : "") + achWhen(g);
      else if (e.art === "zahl" && cnt[e.id]) txt += " (" + cnt[e.id] + " von " + e.stufen[i] + ")";
      const status = lvl ? STUFEN[lvl - 1] : "Noch nicht erreicht";
      // Kleines Abzeichen; Erklärung erscheint beim Darüberfahren (am Handy beim Antippen)
      return el("button", { type: "button", class: "ach lvl" + lvl,
        "aria-label": e.name + ": " + status + ". " + e.text(e.stufen[i]) }, [
        el("span", { class: "ach-icon", text: e.icon, "aria-hidden": "true" }),
        el("span", { class: "ach-tip", "aria-hidden": "true" }, [
          el("b", { text: e.name + (lvl ? " · " + STUFEN[lvl - 1] : "") }),
          el("span", { class: "ach-line" + (g ? " done" : ""), text: txt }),
        ]),
      ]);
    })),
  ]);
}

// Hinweis am Spieltag: wer hier eine neue Stufe geschafft hat (je Erfolg nur die höchste)
export function achievementsOfDay(d) {
  const a = computeAchievements();
  const items = [];
  Object.keys(a.got).sort(function (x, y) { return x.localeCompare(y, "de"); }).forEach(function (name) {
    ERFOLGE.forEach(function (e) {
      const st = a.got[name][e.id] || [];
      let best = -1;
      st.forEach(function (g, i) { if (g && g.current && Number(g.nr) === Number(d.nr)) best = i; });
      if (best >= 0) items.push({ name: name, e: e, i: best, g: st[best] });
    });
  });
  if (!items.length) return null;
  // Höchste Stufe zuerst; standardmäßig nur die erste Meldung, der Rest auf Klick
  items.sort(function (x, y) { return y.i - x.i; });
  const open = achDayOpen === d.nr;
  const shown = open ? items : items.slice(0, 1);
  return el("div", { class: "ach-day" }, [
    el("span", { class: "ach-day-title", text: "🎉 Neu" }),
    el("ul", null, shown.map(function (it) {
      return el("li", null, [
        nameBtn(it.name),
        document.createTextNode(" " + it.e.icon + " " + it.e.name + " " + STUFEN[it.i] +
          (it.g.detail ? " (" + it.g.detail.replace(/ gegen .*$/, "") + ")" : "")),
      ]);
    })),
    items.length > 1 ? el("button", { type: "button", class: "linkbtn ach-more",
      text: open ? "weniger" : "+" + (items.length - 1) + " weitere",
      onclick: function () { achDayOpen = open ? null : d.nr; render(); } }) : null,
  ]);
}
