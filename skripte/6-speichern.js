// =====================================================================
//  Liga-Seite – Bearbeiten-Leiste, Anmeldung mit Passwort, Speichern bei GitHub, Datei erzeugen
// =====================================================================
"use strict";

// ===================================================================
//  Bearbeiten-Leiste, Anmeldung, Speichern
// ===================================================================
function renderEditBar() {
  const bar = document.getElementById("editbar");
  bar.innerHTML = "";
  if (!editing) { bar.hidden = true; return; }
  bar.hidden = false;
  const target = gh.connected ? "Speichert in " + gh.repo + " (" + gh.branch + ")" : "Ohne GitHub-Verbindung – Änderungen bitte als Datei herunterladen";
  bar.appendChild(el("div", null, [
    el("div", { class: "status" + (statusKind ? " " + statusKind : ""), text: statusText || (dirty ? "Ungespeicherte Änderungen" : "Keine Änderungen") }),
    el("div", { class: "status", text: target }),
  ]));
  const btns = [];
  if (gh.connected) {
    btns.push(el("button", { class: "btn primary", type: "button", text: saving ? "Speichert …" : "Speichern", disabled: saving || !dirty ? "disabled" : null, onclick: saveToGitHub }));
  }
  btns.push(el("button", { class: "btn" + (gh.connected ? "" : " primary"), type: "button", text: "Datei herunterladen", onclick: downloadFile }));
  if (gh.connected && typeof openSeasonEnd === "function") {
    btns.push(el("button", { class: "btn", type: "button", text: "Saison abschließen", onclick: openSeasonEnd }));
  }
  if (load("liga.token")) {
    btns.push(el("button", { class: "btn", type: "button", text: "Gerät abmelden", onclick: function () {
      store("liga.token", null);
      statusText = "Abgemeldet. Beim nächsten Mal wird wieder das Passwort abgefragt.";
      statusKind = "ok";
      renderEditBar();
    } }));
  }
  btns.push(el("button", { class: "btn", type: "button", text: "Fertig", onclick: leaveEdit }));
  bar.appendChild(el("div", { class: "row" }, btns));
}

function renderFooter() {
  const f = document.getElementById("footer");
  f.innerHTML = "";
  const stand = fmtStand(LIGA_DATA.stand);
  f.appendChild(el("span", { text: (stand ? "Stand: " + stand + " · " : "") + "Tabelle wird automatisch aus den Ergebnissen berechnet." }));
  const links = el("span", { class: "footer-links" });
  if (typeof installButton === "function") { const ib = installButton(); if (ib) links.appendChild(ib); }
  f.appendChild(links);
  const archive = typeof viewingArchive === "function" && viewingArchive();
  if (!editing && !archive) links.appendChild(el("button", { class: "linkbtn", type: "button", text: "Ergebnisse bearbeiten", onclick: function () { openAdmin(false); } }));
  if (typeof renderSeasonBar === "function") renderSeasonBar();
}

// Zeitpunkt der letzten Speicherung, z. B. „24.10.2026, 22:14 Uhr“
function fmtStand(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + ", " +
    d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

function store(key, val) {
  try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (e) { /* nicht verfügbar */ }
}
function load(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function guessRepo() {
  const host = location.hostname;
  if (/\.github\.io$/i.test(host)) {
    const owner = host.split(".")[0];
    const first = location.pathname.split("/").filter(Boolean)[0];
    const repo = first && !/\.html?$/i.test(first) ? first : host;
    return owner + "/" + repo;
  }
  return "";
}

// ---------- Zugang mit Passwort ----------
const ACCESS_FILE = "daten/zugang.js";
const PBKDF2_ITER = 600000;

function hasAccess() {
  return typeof ZUGANG !== "undefined" && ZUGANG && ZUGANG.data && ZUGANG.salt && ZUGANG.iv;
}
function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function cryptoReady() {
  return !!(window.crypto && window.crypto.subtle);
}
async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptToken(token, password, repo, branch) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITER);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(JSON.stringify({ token: token })));
  return { v: 1, repo: repo, branch: branch, iter: PBKDF2_ITER, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ct)) };
}
async function decryptToken(z, password) {
  const key = await deriveKey(password, b64ToBytes(z.salt), Number(z.iter) || PBKDF2_ITER);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(z.iv) }, key, b64ToBytes(z.data));
  } catch (e) {
    throw new Error("Falsches Passwort.");
  }
  return JSON.parse(new TextDecoder().decode(pt)).token;
}
function accessFileText(z) {
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

async function putFile(path, text, message) {
  const url = "https://api.github.com/repos/" + gh.repo + "/contents/" + path;
  let sha = null;
  const g = await fetch(url + "?ref=" + encodeURIComponent(gh.branch), { headers: apiHeaders(), cache: "no-store" });
  if (g.ok) sha = (await g.json()).sha;
  else if (g.status !== 404) throw new Error("GitHub antwortet mit Fehler " + g.status + ".");
  const body = { message: message, content: b64encode(text), branch: gh.branch };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: "PUT", headers: apiHeaders(), body: JSON.stringify(body) });
  if (r.status === 401) throw new Error("Der Token ist ungültig oder abgelaufen.");
  if (r.status === 403 || r.status === 404) throw new Error("Der Token darf in dieses Repository nicht schreiben (Berechtigung „Contents: Read and write“ nötig).");
  if (!r.ok) throw new Error("GitHub antwortet mit Fehler " + r.status + ".");
  const j = await r.json().catch(function () { return null; });
  return j && j.content ? j.content.sha : null;
}

function setMsg(msg, text, kind) {
  msg.className = "status" + (kind ? " " + kind : "");
  msg.textContent = text;
}

async function openAdmin(forceSetup) {
  const box = document.getElementById("admin");
  box.innerHTML = "";
  box.hidden = false;

  // Auf diesem Gerät schon angemeldet?
  const storedToken = load("liga.token");
  if (!forceSetup && storedToken && load("liga.repo")) {
    const msg = el("p", { class: "status", text: "Melde an …" });
    box.appendChild(el("div", { class: "card admin" }, [el("h2", { text: "Ergebnisse bearbeiten" }), msg]));
    if (await connect(load("liga.repo"), load("liga.branch") || "main", storedToken, true, msg)) {
      startEdit("Angemeldet. Aktueller Stand aus GitHub geladen.");
    } else {
      store("liga.token", null);
      msg.appendChild(document.createTextNode(" Bitte neu anmelden."));
      setTimeout(function () { openAdmin(false); }, 1500);
    }
    return;
  }

  if (hasAccess() && !forceSetup) {
    const pwIn = el("input", { type: "password", autocomplete: "current-password", placeholder: "Passwort" });
    const remember = el("input", { type: "checkbox" });
    const msg = el("p", { class: "status", text: "" });
    const doLogin = async function () {
      if (!cryptoReady()) { setMsg(msg, "Dein Browser unterstützt die Verschlüsselung hier nicht. Öffne die Seite über https.", "err"); return; }
      if (!pwIn.value) { setMsg(msg, "Bitte das Passwort eingeben.", "err"); return; }
      setMsg(msg, "Prüfe Passwort …");
      let token;
      try { token = await decryptToken(ZUGANG, pwIn.value); }
      catch (e) { setMsg(msg, e.message || "Falsches Passwort.", "err"); return; }
      if (await connect(ZUGANG.repo, ZUGANG.branch || "main", token, remember.checked, msg)) {
        startEdit("Angemeldet. Aktueller Stand aus GitHub geladen.");
      }
    };
    pwIn.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    box.appendChild(el("div", { class: "card admin" }, [
      el("h2", { text: "Ergebnisse bearbeiten" }),
      el("p", { text: "Gib das Bearbeiten-Passwort ein." }),
      el("label", { class: "field" }, [document.createTextNode("Passwort"), pwIn]),
      el("label", { class: "check" }, [remember, document.createTextNode("Auf diesem Gerät angemeldet bleiben (nur auf deinem eigenen Gerät)")]),
      el("div", { class: "row" }, [
        el("button", { class: "btn primary", type: "button", text: "Anmelden", onclick: doLogin }),
        el("button", { class: "btn", type: "button", text: "Abbrechen", onclick: function () { box.hidden = true; } }),
        el("button", { class: "linkbtn", type: "button", text: "Zugang neu einrichten", onclick: function () { openAdmin(true); } }),
      ]),
      msg,
    ]));
    pwIn.focus();
    return;
  }

  // Einrichtung: Token + Passwort -> zugang.js
  const repoIn = el("input", { type: "text", value: load("liga.repo") || (hasAccess() ? ZUGANG.repo : "") || guessRepo(), placeholder: "benutzername/repository", autocomplete: "off" });
  const branchIn = el("input", { type: "text", value: load("liga.branch") || (hasAccess() ? ZUGANG.branch : "") || "main", autocomplete: "off" });
  const tokenIn = el("input", { type: "password", placeholder: "github_pat_…", autocomplete: "off" });
  const pw1 = el("input", { type: "password", autocomplete: "new-password", placeholder: "mindestens 12 Zeichen" });
  const pw2 = el("input", { type: "password", autocomplete: "new-password" });
  const msg = el("p", { class: "status", text: "" });

  const doSetup = async function () {
    const repo = repoIn.value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
    const branch = branchIn.value.trim() || "main";
    const token = tokenIn.value.trim();
    if (!cryptoReady()) { setMsg(msg, "Dein Browser unterstützt die Verschlüsselung hier nicht. Öffne die Seite über https.", "err"); return; }
    if (!token) { setMsg(msg, "Bitte den GitHub-Token eintragen.", "err"); return; }
    if (pw1.value.length < 12) { setMsg(msg, "Das Passwort muss mindestens 12 Zeichen lang sein. Am besten mehrere zufällige Wörter.", "err"); return; }
    if (pw1.value !== pw2.value) { setMsg(msg, "Die beiden Passwörter stimmen nicht überein.", "err"); return; }
    if (!(await connect(repo, branch, token, false, msg))) return;
    try {
      setMsg(msg, "Verschlüssele den Token und speichere zugang.js …");
      const z = await encryptToken(token, pw1.value, repo, branch);
      await putFile(ACCESS_FILE, accessFileText(z), "Zugang für Ergebnisse bearbeiten eingerichtet");
      window.ZUGANG_NEU = z;
      startEdit("Zugang eingerichtet. Ab jetzt reicht das Passwort (in etwa einer Minute aktiv).");
    } catch (e) {
      gh.connected = false;
      setMsg(msg, (e && e.message) ? e.message : "Einrichten fehlgeschlagen.", "err");
    }
  };

  const kids = [
    el("h2", { text: hasAccess() ? "Zugang neu einrichten" : "Zugang einrichten" }),
    el("p", { text: "Einmalig: Trag deinen GitHub-Token und ein Passwort ein. Die Seite verschlüsselt den Token mit dem Passwort und legt ihn als zugang.js im Repository ab. Danach reicht zum Bearbeiten das Passwort." }),
    el("label", { class: "field" }, [document.createTextNode("Repository"), repoIn]),
    el("label", { class: "field" }, [document.createTextNode("Branch"), branchIn]),
    el("label", { class: "field" }, [document.createTextNode("GitHub-Token (Fine-grained, nur dieses Repository, Contents: Read and write)"), tokenIn]),
    el("label", { class: "field" }, [document.createTextNode("Neues Bearbeiten-Passwort"), pw1]),
    el("label", { class: "field" }, [document.createTextNode("Passwort wiederholen"), pw2]),
    el("div", { class: "row" }, [
      el("button", { class: "btn primary", type: "button", text: "Zugang einrichten", onclick: doSetup }),
      el("button", { class: "btn", type: "button", text: "Ohne GitHub bearbeiten", onclick: function () {
        gh.connected = false; startEdit("Bearbeiten ohne GitHub-Verbindung.");
      } }),
      hasAccess()
        ? el("button", { class: "btn", type: "button", text: "Zurück zur Anmeldung", onclick: function () { openAdmin(false); } })
        : el("button", { class: "btn", type: "button", text: "Abbrechen", onclick: function () { box.hidden = true; } }),
    ]),
    msg,
  ];
  box.appendChild(el("div", { class: "card admin" }, kids));
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

function apiUrl() {
  return "https://api.github.com/repos/" + gh.repo + "/contents/" + DATA_FILE;
}
function apiHeaders() {
  return {
    "Authorization": "Bearer " + gh.token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}
function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function parseDataFile(text) {
  const f = new Function(text + "\n;return { liga: (typeof LIGA !== 'undefined' ? LIGA : null), tage: (typeof SPIELTAGE !== 'undefined' ? SPIELTAGE : null) };");
  return f();
}

async function connect(repo, branch, token, remember, msg) {
  setMsg(msg, "Verbinde mit GitHub …");
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo || "")) { setMsg(msg, "Bitte das Repository als benutzername/repository angeben.", "err"); return false; }
  gh.repo = repo; gh.branch = branch; gh.token = token;
  try {
    const r = await fetch(apiUrl() + "?ref=" + encodeURIComponent(branch), { headers: apiHeaders(), cache: "no-store" });
    if (r.status === 401) throw new Error("Der Token ist ungültig oder abgelaufen. Richte den Zugang mit einem neuen Token neu ein.");
    if (r.status === 403) throw new Error("Der Token hat keinen Zugriff auf dieses Repository.");
    if (r.status === 404) throw new Error("Repository, Branch oder ergebnisse.js nicht gefunden. Stimmen Name und Branch, und darf der Token dieses Repository lesen?");
    if (!r.ok) throw new Error("GitHub antwortet mit Fehler " + r.status + ".");
    const j = await r.json();
    const parsed = parseDataFile(b64decode(j.content));
    if (!parsed.tage) throw new Error("In ergebnisse.js wurde keine Liste SPIELTAGE gefunden.");
    gh.sha = j.sha;
    gh.connected = true;
    if (parsed.liga) LIGA_DATA = clone(parsed.liga);
    DAYS = clone(parsed.tage);
    gitBase = snapshot();
    store("liga.repo", repo); store("liga.branch", branch);
    store("liga.token", remember ? token : null);
    currentIdx = DAYS.length - 1;
    return true;
  } catch (e) {
    gh.connected = false;
    setMsg(msg, (e && e.message) ? e.message : "Verbindung fehlgeschlagen.", "err");
    return false;
  }
}

function startEdit(text) {
  editing = true; dirty = false;
  statusText = text; statusKind = "ok";
  document.getElementById("admin").hidden = true;
  render();
  document.getElementById("spieltage").scrollIntoView({ behavior: "smooth", block: "start" });
}

function leaveEdit() {
  if (dirty && !confirm("Es gibt ungespeicherte Änderungen. Trotzdem beenden? Die Änderungen gehen dann verloren.")) return;
  if (dirty) location.reload();
  editing = false; statusText = ""; statusKind = "";
  render();
}

async function saveToGitHub() {
  if (!gh.connected || saving) return;
  saving = true; statusText = "Speichert …"; statusKind = ""; renderEditBar();
  let mergedInfo = null;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const now = new Date();
      LIGA_DATA.stand = now.toISOString();
      const body = {
        message: "Ergebnisse aktualisiert (" + now.toLocaleDateString("de-DE") + " " + now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + ")",
        content: b64encode(serialize()),
        branch: gh.branch,
      };
      if (gh.sha) body.sha = gh.sha;
      const r = await fetch(apiUrl(), { method: "PUT", headers: apiHeaders(), body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 422) {
        // Jemand anderes hat inzwischen gespeichert: zusammenführen und erneut versuchen
        statusText = "Jemand anderes hat gerade gespeichert – führe die Änderungen zusammen …"; renderEditBar();
        mergedInfo = await pullAndMerge();
        render();
        continue;
      }
      if (r.status === 401) throw new Error("Der Token ist ungültig oder abgelaufen.");
      if (r.status === 403 || r.status === 404) throw new Error("Der Token darf in dieses Repository nicht schreiben (Berechtigung „Contents: Read and write“ nötig).");
      if (!r.ok) throw new Error("GitHub antwortet mit Fehler " + r.status + ".");
      const j = await r.json();
      gh.sha = j.content && j.content.sha ? j.content.sha : gh.sha;
      gitBase = snapshot();
      dirty = false;
      statusText = mergedInfo
        ? "Gespeichert. Die gleichzeitigen Änderungen einer anderen Person wurden übernommen" + (mergedInfo.conflicts ? " (" + mergedInfo.conflicts + " Konflikt" + (mergedInfo.conflicts === 1 ? "" : "e") + " entschieden)." : ".")
        : "Gespeichert. In etwa einer Minute sehen alle den neuen Stand.";
      statusKind = "ok";
      saving = false;
      render();
      return;
    }
    throw new Error("Speichern ist mehrmals mit anderen Änderungen zusammengestoßen. Bitte gleich noch einmal auf Speichern drücken.");
  } catch (e) {
    statusText = (e && e.message) ? e.message : "Speichern fehlgeschlagen.";
    statusKind = "err";
  }
  saving = false;
  renderEditBar();
}

function downloadFile() {
  const blob = new Blob([serialize()], { type: "text/javascript;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: "ergebnisse.js" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  statusText = "Datei heruntergeladen. Lade sie in GitHub hoch und ersetze damit die alte ergebnisse.js.";
  statusKind = "ok";
  renderEditBar();
}

// ===================================================================
//  ergebnisse.js erzeugen
// ===================================================================
const HEADER = [
  "// =====================================================================",
  "//  ERGEBNISSE",
  "// =====================================================================",
  "//",
  "//  Diese Datei kannst du auf der Seite über „Ergebnisse bearbeiten“",
  "//  ändern oder weiterhin hier von Hand bearbeiten.",
  "//",
  "//  Aufbau eines Spieltags:",
  "//  - spieler: bis zu 8 Namen in der Reihenfolge A bis H, freie Plätze = null",
  "//        VF1: A gegen B   VF2: C gegen D   VF3: E gegen F   VF4: G gegen H",
  "//  - sieger:  Name des Siegers je Spiel; noch nicht gespielte Spiele weglassen",
  "//        7–8 Spieler: VF1–VF4, PR1, PR2, HF1, HF2, P7, P5, P3, Finale",
  "//        5–6 Spieler: VF1–VF3, Gewinnergruppe G1–G3, Verlierergruppe V1–V3",
  "//          G1: Sieger VF1 – VF2   G2: Sieger VF2 – VF3   G3: Sieger VF1 – VF3",
  "//          (V1–V3 genauso mit den Verlierern)",
  "//  - ergebnisse: Legs je Spiel, z. B. VF1: { \"Anna\": 3, \"Ben\": 1 }",
  "//        (optional; der Sieger ergibt sich dann aus den Legs)",
  "//  - bonus: optional je Spieler und Spieltag: höchstes Checkout (co),",
  "//        kürzestes Leg in Darts (leg) und Anzahl 180er (n180),",
  "//        z. B. bonus: { \"Anna\": { co: 121, n180: 2 }, \"Ben\": { leg: 15 } }",
  "//  - statistik: optional je Spiel und Spieler Average (avg) und Missed",
  "//        Doubles (miss), z. B. VF1: { \"Anna\": { avg: 54.3, miss: 4 } }",
  "//        Checkout-Quote = gewonnene Legs / (gewonnene Legs + Missed Doubles)",
  "//  - stechen: nur bei Gleichstand in einer Dreiergruppe, Reihenfolge ab Platz 1",
  "//",
  "//  Namen immer genau gleich schreiben (z. B. immer \"Max\", nie \"max\").",
  "// =====================================================================",
  "",
].join("\n");

function q(v) { return v === null || v === undefined || String(v).trim() === "" ? "null" : JSON.stringify(String(v).trim()); }

function serialize() {
  const out = [HEADER];
  out.push("const LIGA = {");
  out.push("  name: " + JSON.stringify(LIGA_DATA.name || "Liga") + ",");
  out.push("  // Punkte für Platz 1 bis 8 an jedem Spieltag");
  out.push("  punkte: [" + punkte().map(Number).join(", ") + "],");
  const bc = bonusCfg();
  out.push("  // Bonuspunkte: höchstes Checkout und kürzestes Leg je Spieltag, jede 180");
  out.push("  bonus: { checkout: " + bc.checkout + ", leg: " + bc.leg + ", je180: " + bc.je180 + " },");
  const ts = (Array.isArray(LIGA_DATA.stechen) ? LIGA_DATA.stechen : []).map(clean).filter(Boolean);
  if (ts.length) {
    out.push("  // Entscheidungsleg/Stechen bei Gleichstand in der Gesamttabelle (bessere zuerst)");
    out.push("  stechen: [" + ts.map(q).join(", ") + "],");
  }
  if (LIGA_DATA.aktuell != null && dayIdxByNr(LIGA_DATA.aktuell) >= 0) {
    out.push("  // Dieser Spieltag wird beim Öffnen der Seite angezeigt (weglassen = neuester)");
    out.push("  aktuell: " + Number(LIGA_DATA.aktuell) + ",");
  }
  if (LIGA_DATA.stand) {
    out.push("  // Zeitpunkt der letzten Speicherung (wird automatisch gesetzt)");
    out.push("  stand: " + JSON.stringify(String(LIGA_DATA.stand)) + ",");
  }
  out.push("};");
  out.push("");
  out.push("const SPIELTAGE = [");
  DAYS.forEach(function (day) {
    const players = (Array.isArray(day.spieler) ? day.spieler.slice(0, 8) : []).map(clean);
    while (players.length && players[players.length - 1] === null) players.pop();
    out.push("  {");
    out.push("    nr: " + (Number(day.nr) || 0) + ",");
    out.push("    datum: " + JSON.stringify(day.datum || "") + ",");
    out.push("    spieler: [" + players.map(q).join(", ") + "],");
    const s = day.sieger || {};
    const keys = KEY_ORDER.filter(function (k) { return clean(s[k]); })
      .concat(Object.keys(s).filter(function (k) { return KEY_ORDER.indexOf(k) < 0 && clean(s[k]); }));
    if (keys.length) {
      out.push("    sieger: {");
      keys.forEach(function (k) { out.push("      " + (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ": " + q(s[k]) + ","); });
      out.push("    },");
    } else {
      out.push("    sieger: {},");
    }
    const eg = day.ergebnisse || {};
    const egKeys = KEY_ORDER.filter(function (k) { return eg[k] && typeof eg[k] === "object" && Object.keys(eg[k]).length === 2; });
    if (egKeys.length) {
      out.push("    ergebnisse: {");
      egKeys.forEach(function (k) {
        const pair = Object.keys(eg[k]).map(function (n) { return q(n) + ": " + (Number(eg[k][n]) || 0); }).join(", ");
        out.push("      " + k + ": { " + pair + " },");
      });
      out.push("    },");
    }
    const bo = day.bonus || {};
    const boNames = Object.keys(bo).filter(function (n) { return bo[n] && Object.keys(bo[n]).length; });
    if (boNames.length) {
      out.push("    bonus: {");
      boNames.forEach(function (n) {
        const f = [];
        ["co", "leg", "n180"].forEach(function (k) { if (bo[n][k] != null && bo[n][k] !== "") f.push(k + ": " + Number(bo[n][k])); });
        if (f.length) out.push("      " + q(n) + ": { " + f.join(", ") + " },");
      });
      out.push("    },");
    }
    const sxAll = day.statistik || {};
    const sxKeys = KEY_ORDER.filter(function (k) { return sxAll[k] && typeof sxAll[k] === "object" && Object.keys(sxAll[k]).length; });
    if (sxKeys.length) {
      out.push("    statistik: {");
      sxKeys.forEach(function (k) {
        const parts = Object.keys(sxAll[k]).map(function (n) {
          const ps = sxAll[k][n] || {};
          const f = [];
          if (toNum(ps.avg) !== null) f.push("avg: " + toNum(ps.avg));
          if (toNum(ps.miss) !== null) f.push("miss: " + toNum(ps.miss));
          return f.length ? q(n) + ": { " + f.join(", ") + " }" : null;
        }).filter(Boolean);
        if (parts.length) out.push("      " + k + ": { " + parts.join(", ") + " },");
      });
      out.push("    },");
    }
    const st = day.stechen || {};
    const stKeys = Object.keys(st).filter(function (k) {
      return Array.isArray(st[k]) && st[k].map(clean).filter(Boolean).length;
    });
    if (stKeys.length) {
      out.push("    stechen: {");
      stKeys.forEach(function (k) { out.push("      " + k + ": [" + st[k].map(clean).filter(Boolean).map(q).join(", ") + "],"); });
      out.push("    },");
    }
    out.push("  },");
  });
  out.push("];");
  out.push("");
  return out.join("\n");
}

// =====================================================================
//  Gleichzeitiges Bearbeiten: Änderungen zusammenführen
//  Hat jemand anderes inzwischen gespeichert, wird dessen Stand geladen
//  und mit den eigenen Änderungen zusammengeführt. Nur wenn beide denselben
//  Eintrag unterschiedlich geändert haben, wird nachgefragt.
// =====================================================================
let gitBase = null;   // Stand beim letzten Laden bzw. Speichern

function snapshot() { return { liga: clone(LIGA_DATA), days: clone(DAYS) }; }

const MERGE_GROUPS = ["sieger", "ergebnisse", "statistik", "bonus", "stechen"];

// Daten in einzelne Einträge zerlegen: "tag|4|ergebnisse|VF1" -> Wert
function flattenData(data) {
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

function unflattenData(flat) {
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

function conflictLabel(key) {
  const parts = key.split("|");
  if (parts[0] === "liga") return parts[1] === "stechen" ? "Entscheidungsleg der Gesamttabelle" : "Liga-Einstellung „" + parts[1] + "“";
  const names = { da: "Spieltag angelegt/gelöscht", datum: "Datum", spieler: "Spielerliste", sieger: "Sieger",
    ergebnisse: "Legs", statistik: "Average/Doppel", bonus: "Bonuswerte", stechen: "Stechen" };
  let t = "Spieltag " + parts[1] + " · " + (names[parts[2]] || parts[2]);
  if (parts[3]) t += " · " + (LABELS[parts[3]] || parts[3]);
  return t;
}

// Drei-Wege-Zusammenführung: Basis (zuletzt geladen), eigene Version, Version auf GitHub
function mergeData(base, local, remote) {
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

// Aktuellen Stand von GitHub holen und mit den eigenen Änderungen zusammenführen
async function pullAndMerge() {
  const r = await fetch(apiUrl() + "?ref=" + encodeURIComponent(gh.branch), { headers: apiHeaders(), cache: "no-store" });
  if (!r.ok) throw new Error("Der aktuelle Stand konnte nicht von GitHub geladen werden (Fehler " + r.status + ").");
  const j = await r.json();
  const parsed = parseDataFile(b64decode(j.content));
  const remote = { liga: parsed.liga || {}, days: parsed.tage || [] };
  const base = gitBase || remote;
  const res = mergeData(base, snapshot(), remote);
  let useMine = true;
  if (res.conflicts.length) {
    const list = res.conflicts.slice(0, 12).map(function (c) { return "• " + conflictLabel(c.key); }).join("\n") +
      (res.conflicts.length > 12 ? "\n• … und " + (res.conflicts.length - 12) + " weitere" : "");
    useMine = confirm("Jemand hat gleichzeitig dieselben Einträge anders gespeichert:\n\n" + list +
      "\n\nOK = deine Eingaben übernehmen\nAbbrechen = die Eingaben der anderen Person behalten");
    if (!useMine) res.conflicts.forEach(function (c) {
      if (c.remote === undefined) delete res.merged[c.key]; else res.merged[c.key] = c.remote;
    });
  }
  const data = unflattenData(res.merged);
  LIGA_DATA = data.liga;
  DAYS = data.days;
  DAYS.forEach(cleanupDay);
  gh.sha = j.sha;
  gitBase = remote;
  return { conflicts: res.conflicts.length, changedByOthers: JSON.stringify(flattenData(base)) !== JSON.stringify(res.R) };
}