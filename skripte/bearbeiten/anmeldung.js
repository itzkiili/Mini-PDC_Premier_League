// =====================================================================
//  Anmeldung für „Ergebnisse bearbeiten“
//  1. Auf diesem Gerät schon angemeldet → direkt verbinden
//  2. zugang.js vorhanden → Passwort abfragen
//  3. sonst (oder „Zugang neu einrichten“) → Token und Passwort einrichten
// =====================================================================
import { ACCESS_FILE, DATA_FILE } from "../kern/konstanten.js";
import { el, setMsg } from "../kern/dom.js";
import { clone, store, load, b64decode } from "../kern/hilfen.js";
import { parseDataFile } from "../kern/daten.js";
import { state, gh } from "../kern/zustand.js";
import { access, cryptoReady, encryptToken, decryptToken, accessFileText } from "./verschluesselung.js";
import { getFile, putFile } from "./github.js";
import { snapshot } from "./zusammenfuehren.js";
import { startEdit } from "./leiste.js";

const LOGGED_IN = "Angemeldet. Aktueller Stand aus GitHub geladen.";
const NO_CRYPTO = "Dein Browser unterstützt die Verschlüsselung hier nicht. Öffne die Seite über https.";

export async function openAdmin(forceSetup) {
  const box = document.getElementById("admin");
  box.innerHTML = "";
  box.hidden = false;
  const storedToken = load("liga.token");
  if (!forceSetup && storedToken && load("liga.repo")) return loginWithStoredToken(box, storedToken);
  if (access() && !forceSetup) return loginForm(box);
  setupForm(box);
}

// ---------- 1. Gespeicherter Token ----------
async function loginWithStoredToken(box, token) {
  const msg = el("p", { class: "status", text: "Melde an …" });
  box.appendChild(el("div", { class: "card admin" }, [el("h2", { text: "Ergebnisse bearbeiten" }), msg]));
  if (await connect(load("liga.repo"), load("liga.branch") || "main", token, true, msg)) {
    startEdit(LOGGED_IN);
  } else {
    store("liga.token", null);
    msg.appendChild(document.createTextNode(" Bitte neu anmelden."));
    setTimeout(function () { openAdmin(false); }, 1500);
  }
}

// ---------- 2. Passwort ----------
function loginForm(box) {
  const z = access();
  const pwIn = el("input", { type: "password", autocomplete: "current-password", placeholder: "Passwort" });
  const remember = el("input", { type: "checkbox" });
  const msg = el("p", { class: "status", text: "" });
  const doLogin = async function () {
    if (!cryptoReady()) { setMsg(msg, NO_CRYPTO, "err"); return; }
    if (!pwIn.value) { setMsg(msg, "Bitte das Passwort eingeben.", "err"); return; }
    setMsg(msg, "Prüfe Passwort …");
    let token;
    try { token = await decryptToken(z, pwIn.value); }
    catch (e) { setMsg(msg, e.message || "Falsches Passwort.", "err"); return; }
    if (await connect(z.repo, z.branch || "main", token, remember.checked, msg)) startEdit(LOGGED_IN);
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
}

// ---------- 3. Einrichten: Token + Passwort -> zugang.js ----------
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

function setupForm(box) {
  const z = access();
  const repoIn = el("input", { type: "text", value: load("liga.repo") || (z ? z.repo : "") || guessRepo(), placeholder: "benutzername/repository", autocomplete: "off" });
  const branchIn = el("input", { type: "text", value: load("liga.branch") || (z ? z.branch : "") || "main", autocomplete: "off" });
  const tokenIn = el("input", { type: "password", placeholder: "github_pat_…", autocomplete: "off" });
  const pw1 = el("input", { type: "password", autocomplete: "new-password", placeholder: "mindestens 12 Zeichen" });
  const pw2 = el("input", { type: "password", autocomplete: "new-password" });
  const msg = el("p", { class: "status", text: "" });

  const doSetup = async function () {
    const repo = repoIn.value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
    const branch = branchIn.value.trim() || "main";
    const token = tokenIn.value.trim();
    if (!cryptoReady()) { setMsg(msg, NO_CRYPTO, "err"); return; }
    if (!token) { setMsg(msg, "Bitte den GitHub-Token eintragen.", "err"); return; }
    if (pw1.value.length < 12) { setMsg(msg, "Das Passwort muss mindestens 12 Zeichen lang sein. Am besten mehrere zufällige Wörter.", "err"); return; }
    if (pw1.value !== pw2.value) { setMsg(msg, "Die beiden Passwörter stimmen nicht überein.", "err"); return; }
    if (!(await connect(repo, branch, token, false, msg))) return;
    try {
      setMsg(msg, "Verschlüssele den Token und speichere zugang.js …");
      const neu = await encryptToken(token, pw1.value, repo, branch);
      await putFile(ACCESS_FILE, accessFileText(neu), "Zugang für Ergebnisse bearbeiten eingerichtet");
      startEdit("Zugang eingerichtet. Ab jetzt reicht das Passwort (in etwa einer Minute aktiv).");
    } catch (e) {
      gh.connected = false;
      setMsg(msg, (e && e.message) ? e.message : "Einrichten fehlgeschlagen.", "err");
    }
  };

  box.appendChild(el("div", { class: "card admin" }, [
    el("h2", { text: z ? "Zugang neu einrichten" : "Zugang einrichten" }),
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
      z
        ? el("button", { class: "btn", type: "button", text: "Zurück zur Anmeldung", onclick: function () { openAdmin(false); } })
        : el("button", { class: "btn", type: "button", text: "Abbrechen", onclick: function () { box.hidden = true; } }),
    ]),
    msg,
  ]));
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------
//  Mit GitHub verbinden und den aktuellen Stand von ergebnisse.js laden
// ---------------------------------------------------------------------
async function connect(repo, branch, token, remember, msg) {
  setMsg(msg, "Verbinde mit GitHub …");
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo || "")) { setMsg(msg, "Bitte das Repository als benutzername/repository angeben.", "err"); return false; }
  gh.repo = repo; gh.branch = branch; gh.token = token;
  try {
    const r = await getFile(DATA_FILE, branch);
    if (r.status === 401) throw new Error("Der Token ist ungültig oder abgelaufen. Richte den Zugang mit einem neuen Token neu ein.");
    if (r.status === 403) throw new Error("Der Token hat keinen Zugriff auf dieses Repository.");
    if (r.status === 404) throw new Error("Repository, Branch oder ergebnisse.js nicht gefunden. Stimmen Name und Branch, und darf der Token dieses Repository lesen?");
    if (!r.ok) throw new Error("GitHub antwortet mit Fehler " + r.status + ".");
    const j = await r.json();
    const parsed = parseDataFile(b64decode(j.content));
    if (!parsed.tage) throw new Error("In ergebnisse.js wurde keine Liste SPIELTAGE gefunden.");
    gh.sha = j.sha;
    gh.connected = true;
    if (parsed.liga) state.liga = clone(parsed.liga);
    state.days = clone(parsed.tage);
    state.gitBase = snapshot();
    store("liga.repo", repo); store("liga.branch", branch);
    store("liga.token", remember ? token : null);
    state.currentIdx = state.days.length - 1;
    return true;
  } catch (e) {
    gh.connected = false;
    setMsg(msg, (e && e.message) ? e.message : "Verbindung fehlgeschlagen.", "err");
    return false;
  }
}
