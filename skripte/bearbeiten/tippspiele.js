// =====================================================================
//  Tippspiele eintragen (Bearbeiten-Modus, Knopf „🔮 Tippspiele“)
//  Name, Datum und beliebig viele Punkte je Spieler. Die Punkte zählen in
//  der Tabelle (Spalte „Tipp“) und im Erfolg „Tippkönig“, nicht als Bonus.
//  Gespeichert wird wie alles andere über „Speichern“ (LIGA.tippspiele).
// =====================================================================
import { el, getDialog, openDialog, closeButton } from "../kern/dom.js";
import { clean } from "../kern/hilfen.js";
import { state, changed } from "../kern/zustand.js";
import { tippWinners, tippList } from "../auswertung/tippspiel.js";

// Alle Spieler der Saison (und wer schon in einem Tippspiel steht), alphabetisch
function seasonPlayers() {
  const set = {};
  state.days.forEach(function (d) { (d.spieler || []).forEach(function (n) { n = clean(n); if (n) set[n] = true; }); });
  (state.liga.tippspiele || []).forEach(function (t) { Object.keys(t.punkte || {}).forEach(function (n) { set[n] = true; }); });
  return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, "de"); });
}

function today() { return new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); }

export function openTippspiele() {
  const dlg = getDialog("tipp-dialog");
  dlg.innerHTML = "";
  const list = state.liga.tippspiele = Array.isArray(state.liga.tippspiele) ? state.liga.tippspiele : [];
  const players = seasonPlayers();
  const redraw = function () { openTippspiele(); };

  const cards = list.map(function (t, idx) {
    t.punkte = t.punkte || {};
    const name = el("input", { type: "text", value: t.name || "", placeholder: "z. B. Tippspiel Grand Slam", maxlength: "60" });
    name.addEventListener("change", function () { t.name = clean(name.value) || "Tippspiel"; changed(); });
    const datum = el("input", { type: "text", value: t.datum || "", placeholder: "TT.MM.JJJJ", maxlength: "10", inputmode: "numeric" });
    datum.addEventListener("change", function () { t.datum = clean(datum.value); changed(); });

    const rows = players.map(function (n) {
      const v = t.punkte[n];
      const inp = el("input", { type: "number", min: "0", max: "999", step: "1", inputmode: "numeric",
        value: v !== undefined ? String(v) : "", placeholder: "–", "aria-label": "Punkte " + n });
      inp.addEventListener("change", function () {
        const x = Math.round(Number(inp.value));
        if (inp.value.trim() === "" || !isFinite(x) || x < 0) { delete t.punkte[n]; inp.value = ""; }
        else { t.punkte[n] = x; inp.value = String(x); }
        changed();
        markWinners();
      });
      return el("label", { class: "tipp-row", "data-name": n }, [el("span", { text: n }), inp]);
    });
    // Sieger hervorheben (ohne neu zu zeichnen, damit die Eingabe nicht springt)
    const markWinners = function () {
      const w = tippWinners(tippList({ tippspiele: [t] })[0]);
      rows.forEach(function (r) { r.classList.toggle("win", w.indexOf(r.getAttribute("data-name")) >= 0); });
    };
    markWinners();

    return el("div", { class: "tipp-card" }, [
      el("div", { class: "tipp-fields" }, [
        el("label", { class: "field" }, [document.createTextNode("Name"), name]),
        el("label", { class: "field" }, [document.createTextNode("Datum"), datum]),
      ]),
      el("div", { class: "tipp-grid" }, rows),
      el("div", { class: "row" }, [
        el("button", { type: "button", class: "btn", text: "Tippspiel löschen", onclick: function () {
          if (!confirm("„" + (t.name || "Tippspiel") + "“ löschen?")) return;
          list.splice(idx, 1);
          if (!list.length) delete state.liga.tippspiele;
          changed();
          redraw();
        } }),
      ]),
    ]);
  });

  dlg.appendChild(el("div", { class: "pc admin" }, [
    el("div", { class: "pc-head" }, [el("h2", { text: "Tippspiele" }), closeButton(dlg)]),
    el("p", { class: "note", text: "Punkte frei eintragen, leer = nicht mitgetippt. Sie zählen in der Tabelle (Spalte „Tipp“), nicht als Bonus. Wer die meisten Punkte hat, gewinnt das Tippspiel (🔮, Erfolg „Tippkönig“). Zum Schluss unten „Speichern“." }),
  ].concat(cards).concat([
    el("div", { class: "row" }, [
      el("button", { type: "button", class: "btn primary", text: "+ Neues Tippspiel", onclick: function () {
        list.unshift({ name: "Tippspiel", datum: today(), punkte: {} });
        state.liga.tippspiele = list;
        changed();
        redraw();
      } }),
    ]),
  ])));
  openDialog(dlg);
}
