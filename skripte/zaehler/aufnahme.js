// =====================================================================
//  Aufnahme-Modus für eigene Caller-Ansagen (im Bearbeiten-Modus)
//  Ablauf je Clip: Aufnehmen → Anhören → Behalten (oder Nochmal).
//  Behaltene Aufnahmen liegen sofort auf diesem Gerät und werden im Zähler
//  benutzt; „Hochladen“ schickt alle neuen in einem Commit zu GitHub.
// =====================================================================
import { CALLER_FILE, CALLER_DIR } from "../kern/konstanten.js";
import { el, getDialog, openDialog } from "../kern/dom.js";
import { bytesToB64, b64encode } from "../kern/hilfen.js";
import { parseCallerFile } from "../kern/daten.js";
import { state, gh } from "../kern/zustand.js";
import { readFile, commitFiles } from "../bearbeiten/github.js";
import { clipCatalog } from "./clips.js";
import {
  audioAvailable, hasClip, isLocal, newLocalIds, localWav, saveLocalClip, deleteLocalClips, markUploaded,
  processRecording, playClips, playWav, stopClips, setPublished, loadLocalClips,
} from "./audio.js";

const MAX_SECONDS = 6;

const rec = {
  current: null,      // ausgewählter Clip (id)
  filter: "fehlt",    // "fehlt" oder "alle"
  phase: "idle",      // "idle", "recording", "review", "busy"
  pending: null,      // frisch aufgenommene WAV (noch nicht behalten)
  stream: null, recorder: null, chunks: [], timer: null, started: 0,
  msg: null,          // { kind, text }
  progress: null,     // Text während des Hochladens
};

// Alle Namen, für die ein Clip gebraucht wird
function playerNames() {
  const set = {};
  state.rows.forEach(function (r) { set[r.name] = true; });
  Object.keys(state.profiles).forEach(function (n) { set[n] = true; });
  state.days.forEach(function (d) { (d.spieler || []).forEach(function (n) { if (n) set[String(n).trim()] = true; }); });
  return Object.keys(set).filter(Boolean);
}

function catalog() { return clipCatalog(playerNames()); }

function nextMissing(afterId) {
  const list = catalog();
  const start = afterId ? list.findIndex(function (c) { return c.id === afterId; }) + 1 : 0;
  for (let k = 0; k < list.length; k++) {
    const c = list[(start + k) % list.length];
    if (!hasClip(c.id)) return c.id;
  }
  return null;
}

// ---------------------------------------------------------------------
//  Öffnen / Schließen
// ---------------------------------------------------------------------
export async function openRecorder() {
  const dlg = getDialog("caller-rec-dialog");
  dlg.setAttribute("aria-label", "Caller-Aufnahmen");
  if (!dlg.dataset.ready) {
    dlg.dataset.ready = "1";
    dlg.addEventListener("close", function () { stopRecording(true); stopClips(); releaseMic(); });
  }
  await loadLocalClips();
  rec.current = nextMissing(null) || catalog()[0].id;
  rec.phase = "idle"; rec.pending = null; rec.msg = null; rec.progress = null;
  draw();
  openDialog(dlg);
}

function releaseMic() {
  if (rec.stream) rec.stream.getTracks().forEach(function (t) { t.stop(); });
  rec.stream = null;
}

// ---------------------------------------------------------------------
//  Aufnehmen
// ---------------------------------------------------------------------
async function startRecording() {
  rec.msg = null;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
    rec.msg = { kind: "err", text: "Dieser Browser kann nicht aufnehmen. Am besten Safari (iPhone) oder Chrome (Android) nehmen." };
    draw(); return;
  }
  try {
    if (!rec.stream) {
      rec.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false },
      });
    }
  } catch (e) {
    rec.msg = { kind: "err", text: "Kein Zugriff aufs Mikrofon. Bitte in den Einstellungen des Browsers erlauben." };
    draw(); return;
  }
  rec.chunks = [];
  rec.recorder = new MediaRecorder(rec.stream);
  rec.recorder.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
  rec.recorder.onstop = finishRecording;
  rec.recorder.start();
  rec.phase = "recording";
  rec.started = Date.now();
  rec.timer = setInterval(function () {
    const t = (Date.now() - rec.started) / 1000;
    const out = document.querySelector("#caller-rec-dialog .rc-time");
    if (out) out.textContent = t.toFixed(1) + " s";
    if (t >= MAX_SECONDS) stopRecording(false);
  }, 100);
  draw();
}

function stopRecording(discard) {
  clearInterval(rec.timer);
  if (rec.recorder && rec.recorder.state !== "inactive") {
    if (discard) rec.recorder.onstop = null;
    rec.recorder.stop();
  }
  if (discard && rec.phase === "recording") rec.phase = "idle";
}

async function finishRecording() {
  rec.phase = "busy"; draw();
  try {
    const blob = new Blob(rec.chunks, { type: rec.recorder.mimeType || "audio/webm" });
    rec.pending = await processRecording(blob);
    rec.phase = "review";
    probe(rec.pending);
  } catch (e) {
    rec.phase = "idle";
    rec.msg = { kind: "err", text: e && e.message ? e.message : "Die Aufnahme konnte nicht verarbeitet werden." };
  }
  draw();
}

// Frische Aufnahme abspielen (noch nicht gespeichert)
function probe(wav) { playWav(wav).catch(function () {}); }

async function keep() {
  await saveLocalClip(rec.current, rec.pending);
  rec.pending = null;
  rec.phase = "idle";
  rec.current = nextMissing(rec.current) || rec.current;
  draw();
}

// ---------------------------------------------------------------------
//  Hochladen: alle neuen Clips + aktualisiertes Verzeichnis in einem Commit
// ---------------------------------------------------------------------
function callerFileText(map) {
  const out = [
    "// =====================================================================",
    "//  CALLER-AUFNAHMEN – eigene Ansagen für den Live-Zähler",
    "//  Wird beim Hochladen im Aufnahme-Modus automatisch geschrieben.",
    "//  Je Clip: Kürzel -> Pfad zur Aufnahme in daten/caller/ (WAV)",
    "// =====================================================================",
    "",
    "const CALLER = {",
  ];
  Object.keys(map).sort().forEach(function (id) { out.push("  " + JSON.stringify(id) + ": " + JSON.stringify(map[id]) + ","); });
  out.push("};", "");
  return out.join("\n");
}

async function upload() {
  const ids = newLocalIds();
  if (!ids.length) return;
  rec.phase = "busy"; rec.msg = null; rec.progress = "Bereite vor …"; draw();
  try {
    const current = await readFile(CALLER_FILE);
    const map = current ? parseCallerFile(current.text) : {};
    const v = Date.now();
    const files = ids.map(function (id) {
      map[id] = CALLER_DIR + id + ".wav?v=" + v;
      return { path: CALLER_DIR + id + ".wav", base64: bytesToB64(new Uint8Array(localWav(id))) };
    });
    files.push({ path: CALLER_FILE, base64: b64encode(callerFileText(map)) });
    await commitFiles(files, "Caller-Aufnahmen: " + ids.length + (ids.length === 1 ? " Clip" : " Clips"), function (done, total) {
      rec.progress = "Lade hoch … " + done + " von " + total;
      const p = document.querySelector("#caller-rec-dialog .rc-progress");
      if (p) p.textContent = rec.progress;
    });
    setPublished(map);
    await markUploaded(ids);
    rec.msg = { kind: "ok", text: ids.length + (ids.length === 1 ? " Aufnahme" : " Aufnahmen") + " hochgeladen. In etwa einer Minute hören alle sie im Zähler." };
  } catch (e) {
    rec.msg = { kind: "err", text: e && e.message ? e.message : "Hochladen fehlgeschlagen." };
  }
  rec.phase = "idle"; rec.progress = null;
  draw();
}

async function discardNew() {
  const ids = newLocalIds();
  if (!ids.length || !confirm(ids.length + " noch nicht hochgeladene Aufnahmen auf diesem Gerät löschen?")) return;
  await deleteLocalClips(ids);
  draw();
}

// ---------------------------------------------------------------------
//  Zeichnen
// ---------------------------------------------------------------------
function btn(text, cls, onclick, attrs) {
  return el("button", Object.assign({ type: "button", class: "zl-btn" + (cls ? " " + cls : ""), text: text, onclick: onclick }, attrs || {}));
}

function draw() {
  const dlg = getDialog("caller-rec-dialog");
  dlg.innerHTML = "";
  const list = catalog();
  const doneCount = list.filter(function (c) { return hasClip(c.id); }).length;
  const fresh = newLocalIds().length;
  const cur = list.filter(function (c) { return c.id === rec.current; })[0] || list[0];

  dlg.appendChild(el("div", { class: "zl-bar" }, [
    btn("✕", "zl-icon", function () { dlg.close(); }, { "aria-label": "Schließen" }),
    el("div", { class: "zl-bar-text" }, [
      el("span", { class: "zl-title", text: "Caller-Aufnahmen" }),
      el("span", { class: "zl-format", text: doneCount + " von " + list.length + " aufgenommen" + (fresh ? " · " + fresh + " neu" : "") }),
    ]),
    el("span", { class: "zl-icon-space" }),
  ]));

  const body = el("div", { class: "zl-body" }, [el("div", null, [
    audioAvailable() ? null : el("p", { class: "zl-error", text: "Dieser Browser kann keine Aufnahmen abspielen." }),
    currentCard(cur),
    rec.msg ? el("p", { class: rec.msg.kind === "err" ? "zl-error" : "zl-ok", text: rec.msg.text }) : null,
    uploadBox(fresh),
    clipList(list),
  ])]);
  dlg.appendChild(body);
}

function currentCard(c) {
  const exists = hasClip(c.id);
  let actions;
  if (rec.phase === "recording") {
    actions = [
      el("span", { class: "rc-live" }, [el("i"), el("span", { class: "rc-time", text: "0.0 s" })]),
      btn("■ Fertig", "primary big", function () { stopRecording(false); }),
    ];
  } else if (rec.phase === "busy") {
    actions = [el("p", { class: "zl-hint rc-progress", text: rec.progress || "Bereite die Aufnahme auf …" })];
  } else if (rec.phase === "review") {
    actions = [
      el("div", { class: "zl-actions" }, [
        btn("▶ Anhören", "", function () { probe(rec.pending); }),
        btn("↺ Nochmal", "", function () { rec.pending = null; startRecording(); }),
      ]),
      btn("✓ Behalten & weiter", "primary big", keep),
    ];
  } else {
    actions = [
      btn("● Aufnehmen", "primary big rc-rec", startRecording),
      el("div", { class: "zl-actions" }, [
        btn("▶ Anhören", "", function () { playClips([c.id]).catch(function () {}); }, { disabled: exists ? null : "disabled" }),
        btn("Überspringen", "", function () { rec.current = nextMissing(c.id) || c.id; rec.msg = null; draw(); }),
      ]),
    ];
  }
  return el("div", { class: "rc-card" + (rec.phase === "recording" ? " live" : "") }, [
    el("p", { class: "zl-kicker", text: c.group + (exists ? (isLocal(c.id) ? " · auf diesem Gerät" : " · hochgeladen") : " · fehlt noch") }),
    el("p", { class: "rc-text", text: c.text }),
    el("p", { class: "zl-hint", text: c.hint }),
  ].concat(actions));
}

function uploadBox(fresh) {
  if (!fresh) return null;
  return el("div", { class: "zl-fmtbox rc-upload" }, [
    el("div", null, [
      el("span", { class: "zl-label", text: "Nur auf diesem Gerät" }),
      el("b", { text: fresh + (fresh === 1 ? " neue Aufnahme" : " neue Aufnahmen") }),
    ]),
    gh.connected
      ? btn("Hochladen", "primary small", upload, { disabled: rec.phase === "busy" ? "disabled" : null })
      : el("span", { class: "zl-hint", text: "Zum Hochladen mit GitHub anmelden" }),
    btn("Löschen", "ghost danger small", discardNew),
  ]);
}

function clipList(list) {
  const shown = rec.filter === "fehlt" ? list.filter(function (c) { return !hasClip(c.id); }) : list;
  const groups = {};
  shown.forEach(function (c) { (groups[c.group] = groups[c.group] || []).push(c); });
  return el("div", { class: "rc-list" }, [
    el("div", { class: "scope-toggle", role: "group", "aria-label": "Anzeigen" }, [
      el("button", { type: "button", class: rec.filter === "fehlt" ? "on" : "", "aria-pressed": rec.filter === "fehlt" ? "true" : "false",
        text: "Fehlt noch (" + list.filter(function (c) { return !hasClip(c.id); }).length + ")", onclick: function () { rec.filter = "fehlt"; draw(); } }),
      el("button", { type: "button", class: rec.filter === "alle" ? "on" : "", "aria-pressed": rec.filter === "alle" ? "true" : "false",
        text: "Alle (" + list.length + ")", onclick: function () { rec.filter = "alle"; draw(); } }),
    ]),
  ].concat(Object.keys(groups).map(function (g) {
    return el("div", null, [
      el("h3", { text: g }),
      el("div", { class: "rc-chips" }, groups[g].map(function (c) {
        const st = hasClip(c.id) ? (isLocal(c.id) ? " local" : " done") : "";
        return el("button", { type: "button", class: "rc-chip" + st + (c.id === rec.current ? " sel" : ""),
          text: g === "Zahlen" ? c.hint : c.text, title: c.text,
          onclick: function () { if (rec.phase === "recording" || rec.phase === "busy") return; rec.current = c.id; rec.pending = null; rec.phase = "idle"; rec.msg = null; draw(); } });
      })),
    ]);
  })).concat(shown.length ? [] : [el("p", { class: "zl-ok", text: "Alles aufgenommen. 🎯" })]));
}
