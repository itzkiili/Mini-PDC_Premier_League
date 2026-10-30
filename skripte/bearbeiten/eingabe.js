// =====================================================================
//  Eingabe im Bearbeiten-Modus: Spieler, Datum, Legs, Average, Bonus, Stechen
//  Jede Eingabe ändert state.days direkt und ruft danach changed() auf.
// =====================================================================
import { LABELS } from "../kern/konstanten.js";
import { el } from "../kern/dom.js";
import { clean, toNum } from "../kern/hilfen.js";
import { state, bonusCfg, changed, render } from "../kern/zustand.js";
import { cleanupDay } from "../auswertung/spieltag.js";
import { isPinnedDay } from "../anzeige/navigation.js";
import { setStatus } from "./leiste.js";

// Nur Ziffern zulassen
function digitsOnly(e) { e.target.value = e.target.value.replace(/[^0-9]/g, ""); }

// Alle Werte verschieden?
function distinct(list) { return list.every(function (v, j) { return list.indexOf(v) === j; }); }

// ---------------------------------------------------------------------
//  Kopf des Spieltags: Datum, „aktueller Spieltag“, löschen
// ---------------------------------------------------------------------
export function dateInput(day) {
  return el("input", {
    class: "date-input", type: "text", value: day.datum || "", placeholder: "TT.MM.JJJJ", "aria-label": "Datum",
    onchange: function (e) { day.datum = e.target.value.trim(); changed(); },
  });
}

export function pinDayButton(day) {
  const pinned = isPinnedDay(day.nr);
  return el("button", { class: "btn pin-day" + (pinned ? " on" : ""), type: "button",
    text: pinned ? "★ Aktueller Spieltag" : "☆ Als aktuell festlegen",
    title: pinned ? "Wird beim Öffnen der Seite angezeigt. Klick: wieder automatisch den neuesten Spieltag zeigen." : "Diesen Spieltag beim Öffnen der Seite anzeigen",
    onclick: function () {
      if (pinned) delete state.liga.aktuell; else state.liga.aktuell = Number(day.nr);
      changed();
    } });
}

export function deleteDayButton(day) {
  return el("button", { class: "btn danger", type: "button", text: "Spieltag löschen", onclick: function () {
    if (!confirm("Spieltag " + (day.nr != null ? day.nr : "") + " wirklich löschen?")) return;
    state.days.splice(state.currentIdx, 1);
    state.currentIdx = state.days.length - 1;
    changed();
  } });
}

export function addDay() {
  const nr = state.days.reduce(function (mx, d) { return Math.max(mx, Number(d.nr) || 0); }, 0) + 1;
  const now = new Date();
  const pad = function (n) { return (n < 10 ? "0" : "") + n; };
  state.days.push({
    nr: nr,
    datum: pad(now.getDate()) + "." + pad(now.getMonth() + 1) + "." + now.getFullYear(),
    spieler: [null, null, null, null, null, null, null, null],
    sieger: {},
  });
  state.currentIdx = state.days.length - 1;
  changed();
}

// ---------------------------------------------------------------------
//  Spieler A–H
// ---------------------------------------------------------------------
export function playerEditor(day) {
  const raw = Array.isArray(day.spieler) ? day.spieler.slice(0, 8) : [];
  while (raw.length < 8) raw.push(null);
  const inputs = raw.map(function (p, i) {
    return el("label", null, [
      document.createTextNode("Spieler " + "ABCDEFGH"[i]),
      el("input", {
        type: "text", value: p || "", list: "known-names", autocomplete: "off",
        onchange: function (e) {
          const arr = raw.slice();
          arr[i] = clean(e.target.value);
          day.spieler = arr;
          cleanupDay(day);
          changed();
        },
      }),
    ]);
  });
  return el("div", { class: "card edit-card" }, [
    el("h3", { text: "Spieler an diesem Spieltag" }),
    el("div", { class: "players-grid" }, inputs),
    el("p", { class: "hint", text: "VF1: A gegen B, VF2: C gegen D, VF3: E gegen F, VF4: G gegen H. Bei 5 oder 6 Spielern nur die ersten Felder ausfüllen, dann wird in Dreiergruppen gespielt. Leere Felder bei 7 Spielern bedeuten ein Freilos." }),
  ]);
}

// ---------------------------------------------------------------------
//  Legs eines Spiels: − [Feld] +
// ---------------------------------------------------------------------
export function scoreInput(day, match, side) {
  const s = side === "a" ? match.a : match.b;
  const val = match.score ? String(side === "a" ? match.score.a : match.score.b) : "";

  // Beide Felder des Spiels lesen und speichern
  function commit(box) {
    const ins = box.querySelectorAll(".score-in");
    const va = ins[0].value.trim(), vb = ins[1].value.trim();
    day.ergebnisse = day.ergebnisse || {};
    day.sieger = day.sieger || {};
    if (va === "" && vb === "") {
      if (!day.ergebnisse[match.id]) return;
      delete day.ergebnisse[match.id];
    } else if (va === "" || vb === "") {
      return; // auf das zweite Feld warten
    } else {
      const x = Math.max(0, parseInt(va, 10) || 0), y = Math.max(0, parseInt(vb, 10) || 0);
      const res = {}; res[match.a.name] = x; res[match.b.name] = y;
      day.ergebnisse[match.id] = res;
      if (x !== y) day.sieger[match.id] = x > y ? match.a.name : match.b.name;
    }
    cleanupDay(day);
    changed();
  }
  function step(e, delta) {
    e.stopPropagation();
    const box = e.currentTarget.closest(".match");
    const input = e.currentTarget.parentNode.querySelector(".score-in");
    const cur = input.value.trim();
    if (cur === "") {
      if (delta < 0) return;
      input.value = "0"; // erster Klick auf + ergibt 0
    } else {
      input.value = String(Math.min(99, Math.max(0, (parseInt(cur, 10) || 0) + delta)));
    }
    commit(box);
  }

  const label = s.name + " (" + LABELS[match.id] + ")";
  return el("span", { class: "score-ctl", onclick: function (e) { e.stopPropagation(); } }, [
    el("button", { type: "button", class: "step", text: "−", "aria-label": "Ein Leg weniger für " + label, onclick: function (e) { step(e, -1); } }),
    el("input", {
      class: "score-in", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "2", value: val,
      "aria-label": "Legs " + label, "data-side": side,
      onclick: function (e) { e.stopPropagation(); },
      onkeydown: function (e) {
        e.stopPropagation();
        if (e.key === "ArrowUp") { e.preventDefault(); e.currentTarget.parentNode.querySelector(".step.plus").click(); }
        if (e.key === "ArrowDown") { e.preventDefault(); e.currentTarget.parentNode.querySelector(".step").click(); }
      },
      oninput: function (e) { e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 2); },
      onchange: function (e) { commit(e.target.closest(".match")); },
    }),
    el("button", { type: "button", class: "step plus", text: "+", "aria-label": "Ein Leg mehr für " + label, onclick: function (e) { step(e, 1); } }),
  ]);
}

// Klick auf einen Namen: als Sieger eintragen, zweiter Klick entfernt das Ergebnis
export function pickWinner(day, id, name) {
  day.sieger = day.sieger || {};
  const e = day.ergebnisse && day.ergebnisse[id];
  if (clean(day.sieger[id]) === name) {
    delete day.sieger[id];
    if (e) delete day.ergebnisse[id];
  } else {
    day.sieger[id] = name;
    // Ein Leg-Ergebnis, das nicht zum neuen Sieger passt, wird entfernt
    if (e) {
      const other = Object.keys(e).filter(function (k) { return k !== name; })[0];
      if (!(Number(e[name]) > Number(e[other]))) delete day.ergebnisse[id];
    }
  }
  cleanupDay(day);
  changed();
}

// ---------------------------------------------------------------------
//  Average & Missed Doubles eines Spiels (aufklappbar)
// ---------------------------------------------------------------------
const openStats = new Set();   // aufgeklappte Spiele, z. B. "2:VF1"

export function statsPanel(day, match) {
  const key = state.currentIdx + ":" + match.id;
  const isOpen = openStats.has(key);
  const has = match.stats && Object.keys(match.stats).length;
  const toggle = el("button", {
    type: "button", class: "stats-toggle" + (has ? " has" : ""),
    text: (isOpen ? "▴ " : "▾ ") + "Average & Doppel" + (has && !isOpen ? " ✓" : ""),
    "aria-expanded": isOpen ? "true" : "false",
    onclick: function (e) { e.stopPropagation(); if (isOpen) openStats.delete(key); else openStats.add(key); render(); },
  });
  if (!isOpen) return [toggle];

  function onStat(e) {
    const n = e.target.getAttribute("data-name"), f = e.target.getAttribute("data-f");
    let v = toNum(e.target.value);
    if (v !== null) {
      if (f === "avg") {
        if (v < 0 || v > 180) {
          const prev = match.stats && match.stats[n] ? toNum(match.stats[n].avg) : null;
          e.target.value = prev !== null ? String(prev).replace(".", ",") : "";
          setStatus("Ein Average muss zwischen 0 und 180 liegen.", "err");
          return;
        }
        v = Math.round(v * 100) / 100;
      } else {
        v = Math.max(0, Math.min(999, Math.round(v)));
      }
    }
    day.statistik = day.statistik || {};
    const mm = day.statistik[match.id] = day.statistik[match.id] || {};
    const p = mm[n] = mm[n] || {};
    if (v === null) delete p[f]; else p[f] = v;
    if (!Object.keys(p).length) delete mm[n];
    if (!Object.keys(mm).length) delete day.statistik[match.id];
    cleanupDay(day);
    changed();
  }
  const rows = [match.a.name, match.b.name].map(function (n) {
    const cur = (match.stats && match.stats[n]) || {};
    return el("div", { class: "stats-row" }, [
      el("span", { class: "nm", text: n }),
      el("label", null, [document.createTextNode("Ø"), el("input", {
        class: "st-in", type: "text", inputmode: "decimal", placeholder: "–", "data-name": n, "data-f": "avg",
        value: toNum(cur.avg) !== null ? String(toNum(cur.avg)).replace(".", ",") : "",
        "aria-label": "Average " + n, onchange: onStat,
      })]),
      el("label", null, [document.createTextNode("Missed"), el("input", {
        class: "st-in small", type: "text", inputmode: "numeric", placeholder: "–", "data-name": n, "data-f": "miss",
        value: toNum(cur.miss) !== null ? String(toNum(cur.miss)) : "",
        "aria-label": "Missed Doubles " + n, onchange: onStat,
      })]),
    ]);
  });
  return [toggle, el("div", { class: "stats-panel", onclick: function (e) { e.stopPropagation(); } }, rows)];
}

// ---------------------------------------------------------------------
//  Bonuspunkte eines Spieltags: High Finish, kürzestes Leg, 180er
// ---------------------------------------------------------------------
const BONUS_LIMITS = {
  co: [2, 170, "Ein Checkout liegt zwischen 2 und 170."],
  leg: [9, 99, "Ein Leg braucht mindestens 9 Darts."],
  n180: [0, 50, "Bitte eine Anzahl zwischen 0 und 50."],
};

export function bonusEditor(day, d) {
  const names = d.players.filter(Boolean);
  function onBonus(e) {
    const n = e.target.getAttribute("data-name"), f = e.target.getAttribute("data-f");
    const raw = e.target.value.trim();
    let v = raw === "" ? null : parseInt(raw, 10);
    const lim = BONUS_LIMITS[f];
    if (v !== null && (!isFinite(v) || v < lim[0] || v > lim[1])) {
      const prev = day.bonus && day.bonus[n] ? day.bonus[n][f] : null;
      e.target.value = prev != null ? String(prev) : "";
      setStatus(lim[2], "err");
      return;
    }
    if (f === "n180" && v === 0) v = null;
    day.bonus = day.bonus || {};
    const p = day.bonus[n] = day.bonus[n] || {};
    if (v === null) delete p[f]; else p[f] = v;
    if (!Object.keys(p).length) delete day.bonus[n];
    cleanupDay(day);
    changed();
  }
  function inp(n, f, ph) {
    const cur = day.bonus && day.bonus[n] ? day.bonus[n][f] : null;
    return el("input", { class: "st-in", type: "text", inputmode: "numeric", maxlength: "3", placeholder: ph,
      value: cur != null ? String(cur) : "", "data-name": n, "data-f": f, onchange: onBonus, oninput: digitsOnly });
  }
  const rows = names.map(function (n) {
    const pts = d.bonus.pointsOf(n);
    return el("tr", null, [
      el("td", { text: n }),
      el("td", { class: "num" }, [inp(n, "co", "–")]),
      el("td", { class: "num" }, [inp(n, "leg", "–")]),
      el("td", { class: "num" }, [inp(n, "n180", "0")]),
      el("td", { class: "num pts" + (pts ? "" : " dash"), text: pts ? "+" + pts : "–" }),
    ]);
  });
  return el("div", { class: "bonus-box" }, [
    el("h3", { text: "Bonuspunkte an diesem Spieltag" }),
    el("div", { class: "card table-wrap" }, [el("table", { class: "bonus-edit" }, [
      el("thead", null, [el("tr", null, [
        el("th", { text: "Spieler" }), el("th", { class: "num", text: "High Finish" }),
        el("th", { class: "num", text: "Kürzestes Leg (Darts)" }), el("th", { class: "num", text: "180er" }), el("th", { class: "num", text: "Bonus" }),
      ])]),
      el("tbody", null, rows),
    ])]),
    el("p", { class: "hint", text: "Leer lassen, was nicht zählt. Höchstes Checkout und kürzestes Leg des Tages bekommen je " + bonusCfg().checkout + " Bonuspunkt, jede 180 zählt einzeln. Bei Gleichstand bekommen alle mit dem Bestwert den Bonus." }),
  ]);
}

// ---------------------------------------------------------------------
//  Stechen
// ---------------------------------------------------------------------

// Gleichstand in einer Dreiergruppe: Reihenfolge Platz für Platz wählen
export function groupStechenEl(day, g) {
  const current = (day.stechen && Array.isArray(day.stechen[g.key])) ? day.stechen[g.key] : [];
  let box = null;
  const selects = g.members.map(function (_, i) {
    const sel = el("select", { "aria-label": "Platz " + (g.offset + i + 1), onchange: function () {
      const vals = Array.prototype.map.call(box.querySelectorAll("select"), function (s) { return s.value; });
      day.stechen = day.stechen || {};
      day.stechen[g.key] = vals;
      const filled = vals.filter(Boolean);
      if (distinct(filled) && filled.length === g.members.length) { changed(); return; }
      // Unvollständig: Auswahl behalten, aber noch nicht neu auswerten
      state.dirty = true;
      if (filled.length === g.members.length) setStatus("Beim Stechen jeden Spieler nur einmal wählen.", "err");
      else setStatus("Ungespeicherte Änderungen", "");
    } }, [el("option", { value: "", text: "–" })].concat(g.members.map(function (n) {
      return el("option", { value: n, text: n, selected: current[i] === n ? "selected" : null });
    })));
    return el("label", null, [document.createTextNode("Platz " + (g.offset + i + 1) + " "), sel]);
  });
  box = el("div", { class: "stechen" }, [el("strong", { text: "Stechen:" })].concat(selects));
  return box;
}

// Gleichstand in der Gesamttabelle (Entscheidungsleg, meist am Saisonende)
export function tableStechenEl(ties) {
  const box = el("div", { class: "table-stechen" }, [
    el("strong", { text: "Gleichstand in der Gesamttabelle" }),
    el("p", { class: "hint", text: "Nur nötig, wenn ein Entscheidungsleg oder Stechen gespielt wurde (meist am Saisonende). Trag die Reihenfolge ein:" }),
  ]);
  ties.forEach(function (names) {
    const row = el("div", { class: "stechen" });
    const selects = names.map(function (_, i) {
      return el("select", { "aria-label": (i + 1) + ". dieser Gruppe" }, [el("option", { value: "", text: "–" })]
        .concat(names.map(function (n) { return el("option", { value: n, text: n }); })));
    });
    const apply = function () {
      const vals = selects.map(function (s) { return s.value; });
      const filled = vals.filter(Boolean);
      if (filled.length < names.length) return;
      if (!distinct(filled)) { setStatus("Beim Entscheidungsleg jeden Spieler nur einmal wählen.", "err"); return; }
      const list = (Array.isArray(state.liga.stechen) ? state.liga.stechen : []).filter(function (n) { return names.indexOf(n) < 0; });
      state.liga.stechen = list.concat(vals);
      changed();
    };
    selects.forEach(function (s, i) {
      s.addEventListener("change", apply);
      row.appendChild(el("label", null, [document.createTextNode((i + 1) + ". "), s]));
    });
    box.appendChild(row);
  });
  return box;
}
