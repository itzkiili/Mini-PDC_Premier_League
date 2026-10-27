// =====================================================================
//  Liga-Seite – Anzeige: Gesamttabelle, Spieltage, Turnierbaum und Gruppen
// =====================================================================
"use strict";

// ===================================================================
//  Hilfsfunktionen für die Anzeige
// ===================================================================
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === "text") e.textContent = v;
    else if (k === "class") e.className = v;
    else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  });
  (children || []).forEach(function (c) { if (c) e.appendChild(c); });
  return e;
}

function changed() {
  dirty = true;
  statusText = "Ungespeicherte Änderungen";
  statusKind = "";
  render();
}

// ===================================================================
//  Rendern
// ===================================================================
// ---------------------------------------------------------------------
//  Gesamttabelle aus einer Liste ausgewerteter Spieltage berechnen
//  (wird auch für den Stand vor dem letzten Spieltag genutzt -> Trendpfeile)
// ---------------------------------------------------------------------
function computeStandings(resolved) {
  const stats = {};
  const h2h = {};
  function stat(name) {
    if (!stats[name]) stats[name] = newAcc({ name: name, days: 0, wins: 0, seconds: 0, points: 0, bonus: 0, lw: 0, ll: 0, legs: false });
    return stats[name];
  }
  resolved.forEach(function (d) {
    d.players.forEach(function (p) {
      if (!p) return;
      const s = stat(p);
      s.days++;
      const b = d.bonus.pointsOf(p);
      s.bonus += b; s.points += b;
    });
    d.places.forEach(function (pl) {
      if (!pl.name) return;
      const s = stat(pl.name);
      s.points += pl.points;
      if (pl.place === 1) s.wins++;
      if (pl.place === 2) s.seconds++;
    });
    Object.keys(d.matches).forEach(function (id) {
      const mt = d.matches[id];
      if (mt.stats) [mt.a.name, mt.b.name].forEach(function (n) { if (n) addMatchStats(stat(n), mt, n); });
      if (mt.state !== "gespielt") return;
      const an = mt.a.name, bn = mt.b.name;
      if (mt.score) {
        const sa = stat(an), sb = stat(bn);
        sa.lw += mt.score.a; sa.ll += mt.score.b; sa.legs = true;
        sb.lw += mt.score.b; sb.ll += mt.score.a; sb.legs = true;
      }
      h2h[mt.winner] = h2h[mt.winner] || {};
      h2h[mt.winner][mt.loser] = (h2h[mt.winner][mt.loser] || 0) + 1;
    });
  });
  function h2hWins(x, y) { return (h2h[x] && h2h[x][y]) || 0; }
  const tableStechen = (Array.isArray(LIGA_DATA.stechen) ? LIGA_DATA.stechen : []).map(clean).filter(Boolean);

  // Sortierung: Punkte, dann bei Gleichstand: 1. direkter Vergleich (wenn jeder
  // gegen jeden gespielt hat), 2. Legdifferenz, 3. gewonnene Spieltage,
  // 4. Entscheidungsleg/Stechen
  const base = Object.keys(stats).map(function (k) { return stats[k]; });
  function keyOf(r) { return [r.points]; }
  base.sort(function (a, b) {
    const ka = keyOf(a), kb = keyOf(b);
    for (let i = 0; i < ka.length; i++) if (kb[i] !== ka[i]) return kb[i] - ka[i];
    return 0;
  });
  const rows = [];
  const openTies = [];
  let rankCounter = 0;
  function pushGroup(list, shared) {
    const rank = rankCounter + 1;
    list.forEach(function (r, i) { r.rank = shared ? rank : rank + i; r.tied = shared && list.length > 1; rows.push(r); });
    rankCounter += list.length;
  }
  function resolveTie(list) {
    if (list.length === 1) { pushGroup(list, false); return; }
    // direkter Vergleich: nur wenn jeder gegen jeden mindestens einmal gespielt hat
    let meaningful = true;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (!h2hWins(list[i].name, list[j].name) && !h2hWins(list[j].name, list[i].name)) meaningful = false;
    }
    if (meaningful) {
      list.forEach(function (r) {
        r.h2h = list.reduce(function (sum, o) { return sum + (o === r ? 0 : h2hWins(r.name, o.name)); }, 0);
      });
      const sorted = list.slice().sort(function (a, b) { return b.h2h - a.h2h; });
      let i = 0;
      while (i < sorted.length) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1].h2h === sorted[i].h2h) j++;
        secondary(sorted.slice(i, j + 1));
        i = j + 1;
      }
    } else {
      secondary(list);
    }
  }
  function secondary(list) {
    if (list.length === 1) { pushGroup(list, false); return; }
    const k2 = function (r) { return [r.lw - r.ll, r.wins]; };
    const sorted = list.slice().sort(function (a, b) {
      const ka = k2(a), kb = k2(b);
      return (kb[0] - ka[0]) || (kb[1] - ka[1]);
    });
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && k2(sorted[j + 1]).join() === k2(sorted[i]).join()) j++;
      stechenGroup(sorted.slice(i, j + 1));
      i = j + 1;
    }
  }
  function stechenGroup(list) {
    if (list.length === 1) { pushGroup(list, false); return; }
    const allIn = list.every(function (r) { return tableStechen.indexOf(r.name) >= 0; });
    if (allIn) {
      list.slice().sort(function (a, b) { return tableStechen.indexOf(a.name) - tableStechen.indexOf(b.name); })
        .forEach(function (r) { pushGroup([r], false); });
    } else {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, "de"); });
      if (list[0].points > 0) openTies.push(list.map(function (r) { return r.name; }));
      pushGroup(list, true);
    }
  }
  let gi = 0;
  while (gi < base.length) {
    let gj = gi;
    while (gj + 1 < base.length && keyOf(base[gj + 1]).join() === keyOf(base[gi]).join()) gj++;
    resolveTie(base.slice(gi, gj + 1));
    gi = gj + 1;
  }
  return { rows: rows, openTies: openTies };
}

// Trendpfeil: Veränderung des Tabellenplatzes seit dem letzten Spieltag
function trendCell(prevRank, r) {
  if (!prevRank) return el("td", { class: "trend" });
  const before = prevRank[r.name];
  if (before === undefined) return el("td", { class: "trend new", text: "neu", title: "Neu in der Tabelle" });
  const diff = before - r.rank;
  if (diff > 0) return el("td", { class: "trend up", text: "▲" + diff, title: "Seit dem letzten Spieltag " + diff + (diff === 1 ? " Platz" : " Plätze") + " verbessert (vorher " + before + ".)" });
  if (diff < 0) return el("td", { class: "trend down", text: "▼" + (-diff), title: "Seit dem letzten Spieltag " + (-diff) + (diff === -1 ? " Platz" : " Plätze") + " verloren (vorher " + before + ".)" });
  return el("td", { class: "trend same", text: "–", title: "Platz unverändert" });
}

// ---------------------------------------------------------------------
//  Saisonfinale (provisorisch nach aktuellem Tabellenstand)
//  Platz 1 hat ein Freilos, Viertelfinale 2–7, 3–6, 4–5,
//  Halbfinale: Platz 1 gegen Sieger 4–5, Sieger 2–7 gegen Sieger 3–6
// ---------------------------------------------------------------------
function renderSeasonFinal(rows, playedDays) {
  const box = document.getElementById("final-bracket");
  const note = document.getElementById("final-note");
  if (!box) return;
  box.innerHTML = "";
  const at = function (place) {
    const r = rows[place - 1];
    return { label: "Platz " + place, name: r && r.points > 0 ? r.name : null };
  };
  const ref = function (text) { return { label: null, name: null, ref: text }; };
  const archived = typeof viewingArchive === "function" && viewingArchive();
  note.textContent = archived
    ? "Paarungen nach der Abschlusstabelle dieser Saison."
    : playedDays
    ? "Provisorisch nach dem aktuellen Tabellenstand (" + playedDays + (playedDays === 1 ? " Spieltag" : " Spieltage") + "). Die endgültigen Paarungen stehen nach dem letzten Spieltag fest."
    : "Die Paarungen ergeben sich aus der Tabelle am Saisonende.";

  function slot(s) {
    if (s.ref) return el("div", { class: "slot tbd" }, [el("span", { class: "nm", text: s.ref })]);
    if (!s.name) return el("div", { class: "slot tbd" }, [el("span", { class: "nm", text: s.label })]);
    return el("div", { class: "slot" }, [nameBtn(s.name), el("span", { class: "right" }, [el("span", { class: "tag", text: s.label })])]);
  }
    function match(title, a, b, isFinal) {
    const preview = a.name && b.name;
    return el("div", { class: "match" + (isFinal ? " final" : "") }, [
      el("div", { class: "match-head" }, [
        el("span", { text: title }),
        preview ? el("button", { type: "button", class: "head-link", text: "Vorschau ›", title: a.name + " und " + b.name + " vergleichen",
          onclick: function () { openCompare(a.name, b.name); } }) : null,
      ]),
      slot(a), slot(b),
    ]);
  }
  function bye(s) {
    return el("div", { class: "match bye-card" }, [
      el("div", { class: "match-head" }, [el("span", { text: "Freilos" })]),
      slot(s),
      el("div", { class: "slot tbd" }, [el("span", { class: "nm", text: "direkt im Halbfinale" })]),
    ]);
  }
  function round(title, items) {
    return el("div", { class: "round" }, [el("div", { class: "round-title", text: title }), el("div", { class: "round-body" }, items)]);
  }
  box.appendChild(el("div", { class: "bracket" }, [
    swipeHint(),
    el("div", { class: "rounds" }, [
      round("Viertelfinale", [
        match("VF1",at(1), at(8)),
        match("VF2", at(4), at(5)),
        match("VF3", at(2), at(7)),
        match("VF4", at(3), at(6)),
      ]),
      round("Halbfinale", [
        match("HF1", ref("Sieger VF1 (1-8)"), ref("Sieger VF2 (4–5)")),
        match("HF2", ref("Sieger VF3 (2–7)"), ref("Sieger VF4 (3–6)")),
      ]),
      round("Finale", [
        match("Finale", ref("Sieger HF1"), ref("Sieger HF2"), true),
      ]),
    ]),
  ]));
}

// ---------- Welcher Spieltag wird geöffnet? ----------
// 1. Link mit #spieltag-3  2. festgelegter aktueller Spieltag (LIGA.aktuell)  3. neuester Spieltag
function dayIdxByNr(nr) {
  for (let i = 0; i < DAYS.length; i++) if (Number(DAYS[i].nr) === Number(nr)) return i;
  return -1;
}
function hashDayNr() {
  const m = /^#spieltag-(\d+)$/i.exec(location.hash);
  return m ? Number(m[1]) : null;
}
function startDayIdx() {
  const h = hashDayNr();
  if (h !== null && dayIdxByNr(h) >= 0) return dayIdxByNr(h);
  if (LIGA_DATA.aktuell != null && dayIdxByNr(LIGA_DATA.aktuell) >= 0) return dayIdxByNr(LIGA_DATA.aktuell);
  return DAYS.length - 1;
}
function setDayHash(nr) {
  try { history.replaceState(null, "", "#spieltag-" + nr); } catch (e) { /* egal */ }
}
function dayLink(nr) {
  return location.origin + location.pathname + location.search + "#spieltag-" + nr;
}
function shareDayLink(nr, btn) {
  const url = dayLink(nr);
  if (navigator.share) {
    navigator.share({ title: (LIGA_DATA.name || "Liga") + " – Spieltag " + nr, url: url }).catch(function () {});
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

function render() {
  const warnings = [];
  const resolved = DAYS.map(function (d) { return resolveDay(d, warnings); });
  lastResolved = resolved;
  lastElo = computeElo(resolved, typeof eloStartFor === "function" ? eloStartFor() : null);
  document.body.classList.toggle("editing", editing);

  if (currentIdx === null || currentIdx >= DAYS.length) currentIdx = startDayIdx();

  // Gesamttabelle
  const standingsData = computeStandings(resolved);
  const rows = standingsData.rows, openTies = standingsData.openTies;

  // Trend: Vergleich mit dem Stand vor dem letzten Spieltag mit Ergebnissen
  const playedIdx = resolved.map(function (d, i) { return d.places.some(function (pl) { return pl.name; }) ? i : -1; })
    .filter(function (i) { return i >= 0; });
  let prevRank = null;
  if (playedIdx.length >= 2) {
    prevRank = {};
    computeStandings(resolved.slice(0, playedIdx[playedIdx.length - 1])).rows
      .forEach(function (r) { prevRank[r.name] = r.rank; });
  }

  lastRows = rows;
  function signed(n) { return n > 0 ? "+" + n : String(n); }
  const standings = document.getElementById("standings");
  standings.innerHTML = "";
  if (!rows.length) {
    standings.appendChild(el("div", { class: "empty", text: "Noch keine Ergebnisse eingetragen." }));
  } else {
    const thead = el("thead", null, [el("tr", null, [
      el("th", { text: "Pl." }),
      el("th", { class: "trend", text: "", title: "Veränderung seit dem letzten Spieltag" }),
      el("th", { text: "Spieler" }),
      el("th", { class: "num opt", text: "Spieltage" }),
      el("th", { class: "num", text: "Siege", title: "Gewonnene Spieltage" }),
      el("th", { class: "num opt", text: "2. Pl.", title: "Zweite Plätze" }),
      el("th", { class: "num opt", text: "Legs" }),
      el("th", { class: "num", text: "Diff." }),
      el("th", { class: "num opt", text: "Ø", title: "3-Dart-Average (Mittelwert der Spiele)" }),
      el("th", { class: "num opt", text: "CO %", title: "Checkout-Quote" }),
      el("th", { class: "num opt", text: "Bonus", title: "Bonuspunkte (in den Punkten enthalten)" }),
      el("th", { class: "num", text: "Punkte" }),
    ])]);
    const tbody = el("tbody");
    rows.forEach(function (r) {
      const rank = r.rank;
      tbody.appendChild(el("tr", { class: r.points > 0 && rank <= 3 ? "r" + rank + (rank === 1 ? " top1" : "") : "" }, [
        el("td", { class: "rank", text: rank + "." }),
        trendCell(prevRank, r),
        el("td", null, [nameBtn(r.name)]),
        el("td", { class: "num opt", text: String(r.days) }),
        el("td", { class: "num", text: String(r.wins) }),
        el("td", { class: "num opt", text: String(r.seconds) }),
        el("td", { class: "num opt" + (r.legs ? "" : " dash"), text: r.legs ? r.lw + ":" + r.ll : "–" }),
        el("td", { class: "num diff" + (r.legs ? "" : " dash"), text: r.legs ? signed(r.lw - r.ll) : "–" }),
        el("td", { class: "num opt" + (r.avgN ? "" : " dash"), text: r.avgN ? fmtAvg(r.avgSum / r.avgN) : "–" }),
        el("td", { class: "num opt" + ((r.coHit + r.coMiss) ? "" : " dash"), text: (r.coHit + r.coMiss) ? pct(r.coHit, r.coHit + r.coMiss) : "–" }),
        el("td", { class: "num opt" + (r.bonus ? "" : " dash"), text: r.bonus ? "+" + r.bonus : "–" }),
        el("td", { class: "num pts", text: String(r.points) }),
      ]));
    });
    standings.appendChild(el("table", null, [thead, tbody]));
    if (editing && openTies.length) standings.appendChild(tableStechenEl(openTies));
  }

  renderSeasonFinal(rows, playedIdx.length);

  // Namensliste für die Eingabefelder
  const dl = document.getElementById("known-names");
  dl.innerHTML = "";
  rows.map(function (r) { return r.name; }).sort(function (a, b) { return a.localeCompare(b, "de"); })
    .forEach(function (n) { dl.appendChild(el("option", { value: n })); });

  // Spieltag-Auswahl
  const tabs = document.getElementById("day-tabs");
  tabs.innerHTML = "";
  resolved.forEach(function (d, i) {
    tabs.appendChild(el("button", {
      type: "button", "aria-pressed": i === currentIdx ? "true" : "false",
      text: "Spieltag " + (d.nr != null ? d.nr : i + 1) + (editing && LIGA_DATA.aktuell != null && Number(LIGA_DATA.aktuell) === Number(d.nr) ? " ★" : ""),
      onclick: function () { currentIdx = i; render(); setDayHash(d.nr != null ? d.nr : i + 1); },
    }));
  });
  if (editing) {
    tabs.appendChild(el("button", { type: "button", text: "+ Neuer Spieltag", onclick: addDay }));
  }

  const view = document.getElementById("day-view");
  view.innerHTML = "";
  if (!resolved.length) {
    view.appendChild(el("div", { class: "card empty", text: editing ? "Noch keine Spieltage. Leg mit „+ Neuer Spieltag“ den ersten an." : "Noch keine Spieltage eingetragen." }));
  } else {
    view.appendChild(dayView(DAYS[currentIdx], resolved[currentIdx]));
  }

  // Kopf
  const name = LIGA_DATA.name || "Liga";
  document.getElementById("liga-name").textContent = name;
  document.title = name + " – Tabelle & Spieltage";
  const played = resolved.filter(function (d) { return d.complete; }).length;
  document.getElementById("liga-sub").textContent =
    played + (played === 1 ? " Spieltag" : " Spieltage") + " abgeschlossen · " + rows.length + " Spieler";

  const grid = document.getElementById("pts-grid");
  grid.innerHTML = "";
   [["7–8 Spieler", punkte()], ["5–6 Spieler", punkte("gruppe")]].forEach(function (row) {
    grid.appendChild(el("div", null, [
      el("span", { class: "pts-title", text: row[0] }),
      el("div", { class: "pts-row" }, row[1].map(function (p, i) {
        return el("div", null, [el("b", { text: String(p) }), el("span", { text: "Platz " + (i + 1) })]);
      })),
    ]));
  });

  // Hinweise
  if (loadError && !gh.connected) {
    warnings.unshift("Die Datei ergebnisse.js wurde nicht gefunden oder enthält einen Fehler (z. B. ein fehlendes Komma oder Anführungszeichen).");
  }
  const wbox = document.getElementById("warnings");
  wbox.innerHTML = "";
  if (warnings.length) {
    wbox.appendChild(el("div", { class: "warn" }, [
      el("strong", { text: "Bitte prüfen:" }),
      el("ul", null, warnings.map(function (w) { return el("li", { text: w }); })),
    ]));
  }

  renderEditBar();
  renderFooter();
}

// ---------- Spieltag ----------
function dayView(day, d) {
  const m = d.matches;
  const wrap = el("div");

  const headKids = [
    el("h3", { text: "Spieltag " + (d.nr != null ? d.nr : currentIdx + 1) + (!editing && d.datum ? " · " + d.datum : "") }),
  ];
  if (editing) {
    headKids.push(el("input", {
      class: "date-input", type: "text", value: day.datum || "", placeholder: "TT.MM.JJJJ", "aria-label": "Datum",
      onchange: function (e) { day.datum = e.target.value.trim(); changed(); },
    }));
  }
  headKids.push(el("span", { class: "badge" + (d.complete ? " done" : ""), text: d.complete ? "abgeschlossen" : "läuft" }));
  if (d.count) headKids.push(el("span", { class: "badge", text: d.count + " Spieler · " + (d.mode === "gruppe" ? "Dreiergruppen" : "Turnierbaum") }));
  if (!editing) {
    const linkBtn = el("button", { class: "linkbtn day-share", type: "button", text: "🔗 Link", title: "Link zu diesem Spieltag teilen",
      onclick: function () { shareDayLink(d.nr != null ? d.nr : currentIdx + 1, linkBtn); } });
    headKids.push(linkBtn);
  } else {
    const pinned = LIGA_DATA.aktuell != null && Number(LIGA_DATA.aktuell) === Number(day.nr);
    headKids.push(el("button", { class: "btn pin-day" + (pinned ? " on" : ""), type: "button",
      text: pinned ? "★ Aktueller Spieltag" : "☆ Als aktuell festlegen",
      title: pinned ? "Wird beim Öffnen der Seite angezeigt. Klick: wieder automatisch den neuesten Spieltag zeigen." : "Diesen Spieltag beim Öffnen der Seite anzeigen",
      onclick: function () {
        if (pinned) delete LIGA_DATA.aktuell; else LIGA_DATA.aktuell = Number(day.nr);
        changed();
      } }));
  }
  if (editing) {
    headKids.push(el("button", { class: "btn danger", type: "button", text: "Spieltag löschen", onclick: function () {
      if (!confirm("Spieltag " + (day.nr != null ? day.nr : "") + " wirklich löschen?")) return;
      DAYS.splice(currentIdx, 1);
      currentIdx = DAYS.length - 1;
      changed();
    } }));
  }
  wrap.appendChild(el("div", { class: "day-head" }, headKids));
  if (!editing && typeof achievementsOfDay === "function") {
    const newAch = achievementsOfDay(d);
    if (newAch) wrap.appendChild(newAch);
  }

  if (editing) wrap.appendChild(playerEditor(day));

  const placeRows = d.places.filter(function (p) { return p.name !== null; }).map(function (p) {
    return el("tr", null, [
      el("td", { class: "rank", text: p.place + "." }),
      p.name === undefined ? el("td", { class: "dash", text: "–" }) : el("td", null, [nameBtn(p.name)]),
      el("td", { class: "num" + (p.name ? " pts" : " dash") }, p.name ? [
        document.createTextNode((p.points + d.bonus.pointsOf(p.name)) + " P."),
        d.bonus.pointsOf(p.name) ? el("span", { class: "bonus-tag", text: "inkl. +" + d.bonus.pointsOf(p.name) }) : null,
      ] : []),
    ]);
  });
  
  // Platzierung erst zeigen, wenn alle Spiele gespielt sind (im Bearbeiten-Modus immer)
  const hidePlaces = !editing && !d.complete && placeRows.length;
  const places = el("div", null, [
    el("h3", { text: "Platzierung" }),
    hidePlaces
      ? el("div", { class: "card places" }, [el("p", { class: "note places-wait", text: "Die Platzierung erscheint, sobald alle Spiele gespielt sind." })])
      : el("div", { class: "card places" }, [el("table", null, [el("tbody", null,
          placeRows.length ? placeRows : [el("tr", null, [el("td", { class: "dash", text: "Noch keine Spieler eingetragen." })])])])]),
  ]);

  let tree;
  if (d.count === 0) {
    tree = [el("div", { class: "bracket" }, [el("p", { class: "note", text: editing ? "Trag oben die Spieler ein, dann erscheint hier der Turnierbaum." : "Noch keine Spieler eingetragen." })])];
  } else if (d.mode === "gruppe") {
    tree = [el("div", { class: "bracket" }, [
      el("h3", { text: "Viertelfinale" }),
      el("div", { class: "rounds" }, [m.VF1, m.VF2, m.VF3].map(function (mt) {
        return el("div", { class: "round" }, [matchEl(day, mt)]);
      })),
    ])].concat(d.groups.map(function (g) { return groupEl(day, g); }));
  } else {
    tree = [
      el("div", { class: "bracket" }, [
        el("h3", { text: "Hauptrunde · Plätze 1–4" }),
        swipeHint(),
        el("div", { class: "rounds" }, [
          roundEl(day, "Viertelfinale", [m.VF1, m.VF2, m.VF3, m.VF4]),
          roundEl(day, "Halbfinale", [m.HF1, m.HF2]),
          roundEl(day, "Platzierung", [m.Finale, m.P3], "Finale"),
        ]),
      ]),
      el("div", { class: "bracket" }, [
        el("h3", { text: "Platzierungsrunde · Plätze 5–8" }),
        swipeHint(),
        el("div", { class: "rounds two" }, [
          roundEl(day, "Platzierungsrunde", [m.PR1, m.PR2]),
          roundEl(day, "Platzierung", [m.P5, m.P7]),
        ]),
      ]),
    ];
  }

  const treeBox = el("div", null, [el("h3", { text: "Turnierbaum" }), el("div", { class: "card" }, tree)]);
  if (editing && d.count) treeBox.appendChild(el("p", { class: "hint", text: "Trag in die Felder die Legs ein, der Sieger ergibt sich dann automatisch. Ohne Legs kannst du auch einfach auf den Namen des Siegers klicken; ein zweiter Klick entfernt das Ergebnis wieder." }));
  wrap.appendChild(el("div", { class: "day-grid" }, [places, treeBox]));
  if (editing && d.count) wrap.appendChild(bonusEditor(day, d));
  else if (d.bonus.any) wrap.appendChild(bonusView(d));
  return wrap;
}

function bonusLines(d) {
  const b = d.bonus, cfg = bonusCfg();
  const lines = [];
  if (b.bestCo !== null) lines.push(["Höchstes Checkout", b.coNames.join(", ") + " (" + b.bestCo + ")", "+" + cfg.checkout]);
  if (b.bestLeg !== null) lines.push(["Kürzestes Leg", b.legNames.join(", ") + " (" + b.bestLeg + " Darts)", "+" + cfg.leg]);
  Object.keys(b.per).filter(function (n) { return b.per[n].n180; }).forEach(function (n) {
    lines.push(["180er", n + " (" + b.per[n].n180 + "×)", "+" + b.per[n].n180 * cfg.je180]);
  });
  return lines;
}
function bonusView(d) {
  return el("div", { class: "bonus-box" }, [
    el("h3", { text: "Bonuspunkte" }),
    el("div", { class: "card" }, [el("table", null, [el("tbody", null, bonusLines(d).map(function (l) {
      return el("tr", null, [el("td", { class: "dash", text: l[0] }), el("td", { text: l[1] }), el("td", { class: "num pts", text: l[2] })]);
    }))])]),
  ]);
}

function slotEl(day, match, side, tagText) {
  const s = side === "a" ? match.a : match.b;
  if (s.pending) return el("div", { class: "slot tbd" }, [el("span", { text: s.from })]);
  if (s.name === null) return el("div", { class: "slot bye" }, [el("span", { text: "Freilos" })]);
  let cls = "slot";
  if (match.winner) cls += match.winner === s.name ? " win" : " lose";
  const pickable = editing && (match.state === "offen" || match.state === "gespielt");
  if (pickable) cls += " pick";
  const kids = [el("span", { class: "nm", text: s.name })];
  const right = el("span", { class: "right" });
  if (tagText) right.appendChild(el("span", { class: "tag", text: tagText }));
  if (pickable) right.appendChild(scoreInput(day, match, side));
  else {
    const ps = match.stats && match.stats[s.name];
    if (ps && toNum(ps.avg) !== null) right.appendChild(el("span", { class: "avg", text: "Ø " + fmtAvg(toNum(ps.avg)) }));
    if (match.score) right.appendChild(el("span", { class: "score", text: String(side === "a" ? match.score.a : match.score.b) }));
  }
  kids.push(right);
  return el("div", {
    class: cls,
    role: pickable ? "button" : null,
    tabindex: pickable ? "0" : null,
    title: pickable ? "Als Sieger eintragen" : null,
    onclick: pickable ? function () { pickWinner(day, match.id, s.name); } : null,
    onkeydown: pickable ? function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickWinner(day, match.id, s.name); } } : null,
  }, kids);
}

// Hinweis am Handy, dass man seitlich wischen kann (nur bei schmalem Bildschirm sichtbar)
function swipeHint() {
  return el("p", { class: "swipe-hint", text: "← Seitlich wischen für die nächste Runde →" });
}

function matchEl(day, match, isFinal) {
  const pl = PLACE_OF[match.id];
  function tagFor(side) {
    if (!pl || !match.winner) return null;
    const s = side === "a" ? match.a : match.b;
    if (!s.name) return null;
    return "Platz " + (s.name === match.winner ? pl[0] : pl[1]);
  }
  let state = "";
  if (match.state === "freilos") state = "kampflos";
  else if (match.state === "offen") state = "offen";
  // Noch nicht gespielt und beide Spieler bekannt: Klick öffnet den Vergleich
  const preview = !editing && match.state === "offen" && match.a.name && match.b.name;
  if (preview) state = "Vorschau ›";
  return el("div", {
    class: "match" + (isFinal ? " final" : "") + (preview ? " preview" : ""),
    role: preview ? "button" : null,
    tabindex: preview ? "0" : null,
    title: preview ? match.a.name + " und " + match.b.name + " vergleichen" : null,
    onclick: preview ? function () { openCompare(match.a.name, match.b.name); } : null,
    onkeydown: preview ? function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCompare(match.a.name, match.b.name); } } : null,
  }, [
    el("div", { class: "match-head" }, [el("span", { text: LABELS[match.id] }), el("span", { text: state })]),
    slotEl(day, match, "a", tagFor("a")),
    slotEl(day, match, "b", tagFor("b")),
  ].concat(editing && (match.state === "offen" || match.state === "gespielt") ? statsPanel(day, match) : []));
}

function roundEl(day, title, matches, finalId) {
  return el("div", { class: "round" }, [
    el("div", { class: "round-title", text: title }),
    el("div", { class: "round-body" }, matches.map(function (mt) {
      return (!mt || mt.state === "leer") ? null : matchEl(day, mt, mt.id === finalId);
    })),
  ]);
}

function groupEl(day, g) {
  const size = g.members.length || 3;
  const range = "Plätze " + (g.offset + 1) + "–" + (g.offset + size);
  let rows;
  if (!g.members.length) {
    rows = [el("tr", null, [el("td", { class: "dash", text: "Wartet auf die Viertelfinals" })])];
  } else {
    const list = g.order || g.members.slice().sort(function (a, b) { return g.wins[b] - g.wins[a]; });
    rows = list.map(function (n, i) {
      return el("tr", null, [
        el("td", { class: "rank", text: g.order ? (g.offset + i + 1) + "." : "–" }),
        el("td", { text: n }),
        el("td", { class: "num", text: g.wins[n] + (g.wins[n] === 1 ? " Sieg" : " Siege") }),
        el("td", { class: "num dash", text: g.legs && g.legs[n] && g.legs[n].any ? g.legs[n].w + ":" + g.legs[n].l : "" }),
      ]);
    });
  }
  let note = null;
  if (g.tie && !g.order) note = el("p", { class: "note", text: "Gleichstand: Jeder hat ein Spiel gewonnen. Die Reihenfolge wird per Stechen ermittelt." });
  else if (g.tie) note = el("p", { class: "note", text: "Reihenfolge nach Stechen." });

  let stechenEl = null;
  if (editing && g.tie) {
    const current = (day.stechen && Array.isArray(day.stechen[g.key])) ? day.stechen[g.key] : [];
    const selects = g.members.map(function (_, i) {
      const sel = el("select", { "aria-label": "Platz " + (g.offset + i + 1), onchange: function () {
        const vals = Array.prototype.map.call(stechenEl.querySelectorAll("select"), function (s) { return s.value; });
        day.stechen = day.stechen || {};
        day.stechen[g.key] = vals;
        const filled = vals.filter(Boolean);
        const distinct = filled.every(function (v, j) { return filled.indexOf(v) === j; });
        if (!distinct || filled.length < g.members.length) {
          // Unvollständig: noch nicht als gültig speichern, aber Auswahl behalten
          day.stechen[g.key] = vals;
          dirty = true; statusText = "Ungespeicherte Änderungen"; statusKind = "";
          if (filled.length === g.members.length && !distinct) { statusText = "Beim Stechen jeden Spieler nur einmal wählen."; statusKind = "err"; }
          renderEditBar();
          return;
        }
        changed();
      } }, [el("option", { value: "", text: "–" })].concat(g.members.map(function (n) {
        return el("option", { value: n, text: n, selected: current[i] === n ? "selected" : null });
      })));
      return el("label", null, [document.createTextNode("Platz " + (g.offset + i + 1) + " "), sel]);
    });
    stechenEl = el("div", { class: "stechen" }, [el("strong", { text: "Stechen:" })].concat(selects));
  }

  const games = g.matches.filter(function (mt) {
    return mt.state !== "leer" && mt.state !== "freilos";
  }).map(function (mt) { return matchEl(day, mt); });
  return el("div", { class: "bracket" }, [
    el("h3", { text: g.title + " · " + range }),
    el("div", { class: "group-grid" }, [
      el("table", { class: "mini" }, [el("tbody", null, rows)]),
      el("div", { class: "games" }, games),
    ]),
    note,
    stechenEl,
  ]);
}