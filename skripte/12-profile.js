// =====================================================================
//  Liga-Seite – Spielerprofile in der Spielerkarte
//  Spitzname, Bild und Walk-on-Song. Gespeichert in daten/spieler.js,
//  Bilder in daten/bilder/. Bearbeiten im Bearbeiten-Modus direkt in
//  der Spielerkarte („Profil bearbeiten“).
// =====================================================================
"use strict";

const PROFILE_FILE = "daten/spieler.js";
const PROFILE_IMG_DIR = "daten/bilder/";
const PROFILE_IMG_SIZE = 400;     // Bilder werden quadratisch auf 400 × 400 verkleinert

let PROFILES = clone(typeof SPIELER !== "undefined" && SPIELER ? SPIELER : {});
const profilePreview = {};        // frisch hochgeladene Bilder, bis GitHub Pages sie ausliefert

function profileOf(name) { return PROFILES[name] || {}; }

function safeLink(url) {
  return /^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : "";
}
// Spotify- oder YouTube-Link → Adresse des eingebetteten Players (sonst null)
function songEmbed(link) {
  if (!link) return null;
  let u;
  try { u = new URL(link); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "open.spotify.com") {
    const m = u.pathname.match(/\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
    if (m) return { kind: "spotify", src: "https://open.spotify.com/embed/" + m[1] + "/" + m[2] + "?theme=0" };
  }
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (/(^|\.)youtube\.com$/.test(host)) {
    id = u.searchParams.get("v");
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
    if (!id && m) id = m[2];
  }
  if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
    // Startzeit aus dem Link übernehmen (z. B. ?t=45 oder ?t=1m5s), praktisch für den Refrain
    const t = u.searchParams.get("t") || u.searchParams.get("start") || "";
    const tm = t.match(/^(?:(\d+)m)?(\d+)s?$/);
    const start = tm ? (Number(tm[1] || 0) * 60 + Number(tm[2])) : 0;
    return { kind: "youtube", src: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&playsinline=1&rel=0" + (start ? "&start=" + start : "") };
  }
  return null;
}

function songPlayer(embed, title) {
  return el("div", { class: "song-player " + embed.kind }, [
    el("iframe", { src: embed.src, title: "Walk-on-Song: " + title, loading: "lazy",
      allow: "autoplay; clipboard-write; encrypted-media; picture-in-picture", allowfullscreen: true }),
  ]);
}

// Spielerkarte geschlossen → Musik aus
(function () {
  const dlg = document.getElementById("player-dialog");
  if (dlg) dlg.addEventListener("close", function () {
    dlg.querySelectorAll(".song-player").forEach(function (x) { x.remove(); });
    dlg.querySelectorAll(".song-btn").forEach(function (b) { b.textContent = "▶ anhören"; });
  });
})();

function safeImg(path) {
  const p = String(path || "").trim();
  return (p.indexOf(PROFILE_IMG_DIR) === 0 || /^https:\/\//i.test(p)) ? p : "";
}
function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
}

// Rundes Bild (oder Initialen) für den Kopf der Spielerkarte
function profileAvatar(name) {
  const src = profilePreview[name] || safeImg(profileOf(name).bild);
  if (src) return el("img", { class: "avatar", src: src, alt: "Bild von " + name });
  return el("span", { class: "avatar initials", text: initials(name), "aria-hidden": "true" });
}

// Spitzname und Song unter dem Namen (+ „Profil bearbeiten“ im Bearbeiten-Modus)
function profileInfo(name) {
  const p = profileOf(name);
  const box = el("div", { class: "profile-info" });
  if (p.spitzname) box.appendChild(el("p", { class: "nickname", text: "„" + p.spitzname + "“" }));
  if (p.song) {
    const link = safeLink(p.songLink);
    const embed = songEmbed(link);
    let player = null;
    const play = embed
      ? el("button", { type: "button", class: "linkbtn song-btn", text: "▶ anhören" })
      : (link ? el("a", { href: link, target: "_blank", rel: "noopener", text: "▶ anhören" }) : null);
    if (embed) play.addEventListener("click", function () {
      if (player) { player.remove(); player = null; play.textContent = "▶ anhören"; return; }
      player = songPlayer(embed, p.song);
      const head = box.closest(".pc-head");
      if (head) head.after(player); else box.appendChild(player);
      play.textContent = "■ Player schließen";
    });
    box.appendChild(el("p", { class: "walkon" }, [el("span", { text: "🎵 " + p.song }), play]));
  }
  if (editing && gh.connected) {
    const editBtn = el("button", { type: "button", class: "linkbtn", text: "✏️ Profil bearbeiten",
      onclick: function () {
        // Formular in voller Breite unter den Kopf der Spielerkarte setzen
        const head = box.closest(".pc-head");
        if (head) head.after(profileEditor(name)); else box.appendChild(profileEditor(name));
        editBtn.hidden = true;
      } });
    box.appendChild(editBtn);
  }
  return box;
}

// ---------- Bearbeiten ----------
function profileSlug(name) {
  return String(name).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "spieler";
}

// Bild quadratisch zuschneiden und verkleinern → JPEG als Data-URL
function shrinkImage(file) {
  return new Promise(function (ok, fail) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
      const c = document.createElement("canvas");
      c.width = c.height = Math.min(PROFILE_IMG_SIZE, side);
      c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = function () { URL.revokeObjectURL(url); fail(new Error("Das Bild konnte nicht gelesen werden.")); };
    img.src = url;
  });
}

function profileEditor(name) {
  const p = profileOf(name);
  let newImg = null, removeImg = false;
  const nick = el("input", { type: "text", value: p.spitzname || "", placeholder: "z. B. The Machine", maxlength: "40" });
  const song = el("input", { type: "text", value: p.song || "", placeholder: "z. B. Eye of the Tiger – Survivor", maxlength: "80" });
  const link = el("input", { type: "url", value: p.songLink || "", placeholder: "Link zu Spotify oder YouTube (optional)" });
  const preview = el("div", { class: "profile-preview" }, [profileAvatar(name)]);
  const file = el("input", { type: "file", accept: "image/*", class: "profile-file" });
  const msg = el("p", { class: "status" });
  const showPreview = function (src) {
    preview.innerHTML = "";
    preview.appendChild(src ? el("img", { class: "avatar", src: src, alt: "" }) : el("span", { class: "avatar initials", text: initials(name) }));
  };
  file.addEventListener("change", function () {
    if (!file.files || !file.files[0]) return;
    setMsg(msg, "Bild wird vorbereitet …");
    shrinkImage(file.files[0]).then(function (data) {
      newImg = data; removeImg = false; showPreview(data); setMsg(msg, "");
    }, function (e) { setMsg(msg, e.message, "err"); });
  });
  const save = el("button", { type: "button", class: "btn primary", text: "Profil speichern" });
  save.addEventListener("click", function () {
    save.disabled = true;
    saveProfile(name, {
      spitzname: nick.value.trim(), song: song.value.trim(), songLink: safeLink(link.value),
    }, newImg, removeImg, msg).then(function (ok) {
      save.disabled = false;
      if (ok) openPlayer(name);
    });
  });
  return el("div", { class: "profile-edit" }, [
    el("label", null, [el("span", { text: "Spitzname" }), nick]),
    el("label", null, [el("span", { text: "Walk-on-Song" }), song]),
    el("label", null, [el("span", { text: "Link zum Song" }), link]),
    el("div", { class: "profile-img-row" }, [
      preview,
      el("label", { class: "btn" }, [document.createTextNode("Bild wählen"), file]),
      (p.bild || profilePreview[name]) ? el("button", { type: "button", class: "linkbtn", text: "Bild entfernen",
        onclick: function () { newImg = null; removeImg = true; showPreview(null); } }) : null,
    ]),
    el("div", { class: "profile-actions" }, [
      save,
      el("button", { type: "button", class: "btn", text: "Abbrechen", onclick: function () { openPlayer(name); } }),
    ]),
    msg,
  ]);
}

// Datei bei GitHub anlegen oder ersetzen (Inhalt bereits Base64)
async function putBase64(path, base64, message) {
  const url = "https://api.github.com/repos/" + gh.repo + "/contents/" + path;
  let sha = null;
  const g = await fetch(url + "?ref=" + encodeURIComponent(gh.branch), { headers: apiHeaders(), cache: "no-store" });
  if (g.ok) sha = (await g.json()).sha;
  else if (g.status !== 404) throw new Error("GitHub antwortet mit Fehler " + g.status + ".");
  const body = { message: message, content: base64, branch: gh.branch };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: "PUT", headers: apiHeaders(), body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) return false;   // gleichzeitig geändert → nochmal
  if (r.status === 401) throw new Error("Der Token ist ungültig oder abgelaufen.");
  if (r.status === 403 || r.status === 404) throw new Error("Der Token darf in dieses Repository nicht schreiben.");
  if (!r.ok) throw new Error("GitHub antwortet mit Fehler " + r.status + ".");
  return true;
}

async function loadProfilesFromGitHub() {
  const url = "https://api.github.com/repos/" + gh.repo + "/contents/" + PROFILE_FILE + "?ref=" + encodeURIComponent(gh.branch);
  const r = await fetch(url, { headers: apiHeaders(), cache: "no-store" });
  if (r.status === 404) return {};
  if (!r.ok) throw new Error("spieler.js konnte nicht geladen werden (Fehler " + r.status + ").");
  const j = await r.json();
  const f = new Function(b64decode(j.content) + "\n;return (typeof SPIELER !== 'undefined' ? SPIELER : {});");
  return f() || {};
}

function serializeProfiles(all) {
  const q = function (v) { return JSON.stringify(v); };
  const out = [
    "// =====================================================================",
    "//  SPIELERPROFILE – Spitzname, Bild und Walk-on-Song",
    "//  Wird beim Bearbeiten auf der Website automatisch geschrieben.",
    "//  Von Hand: Name genau wie in ergebnisse.js schreiben.",
    "//    bild:     Pfad zum Bild in daten/bilder/ (quadratisch, z. B. 400 × 400)",
    "//    songLink: Link zu Spotify oder YouTube (optional)",
    "// =====================================================================",
    "",
    "const SPIELER = {",
  ];
  Object.keys(all).sort(function (a, b) { return a.localeCompare(b, "de"); }).forEach(function (n) {
    const p = all[n] || {};
    const f = ["spitzname", "bild", "song", "songLink"].filter(function (k) { return p[k]; });
    if (!f.length) return;
    out.push("  " + q(n) + ": {");
    f.forEach(function (k) { out.push("    " + k + ": " + q(p[k]) + ","); });
    out.push("  },");
  });
  out.push("};", "");
  return out.join("\n");
}

async function saveProfile(name, fields, newImg, removeImg, msg) {
  try {
    const entry = { spitzname: fields.spitzname, song: fields.song, songLink: fields.songLink };
    const old = profileOf(name);
    if (newImg) {
      setMsg(msg, "Lade Bild hoch …");
      const path = PROFILE_IMG_DIR + profileSlug(name) + ".jpg";
      let ok = await putBase64(path, newImg.split(",")[1], "Profilbild: " + name);
      if (!ok) ok = await putBase64(path, newImg.split(",")[1], "Profilbild: " + name);
      if (!ok) throw new Error("Das Bild konnte nicht gespeichert werden. Bitte noch einmal versuchen.");
      entry.bild = path + "?v=" + Date.now();       // neue Nummer, damit kein altes Bild aus dem Speicher kommt
      profilePreview[name] = newImg;
    } else if (!removeImg && old.bild) {
      entry.bild = old.bild;
    } else {
      delete profilePreview[name];
    }
    // Neuesten Stand holen und nur diesen Spieler ändern (andere Profile bleiben unberührt)
    for (let attempt = 0; attempt < 3; attempt++) {
      setMsg(msg, "Speichere Profil …");
      const all = await loadProfilesFromGitHub();
      all[name] = entry;
      const ok = await putBase64(PROFILE_FILE, b64encode(serializeProfiles(all)), "Profil: " + name);
      if (ok) { PROFILES = all; return true; }
    }
    throw new Error("Speichern ist mit einer anderen Änderung zusammengestoßen. Bitte noch einmal versuchen.");
  } catch (e) {
    setMsg(msg, (e && e.message) ? e.message : "Speichern fehlgeschlagen.", "err");
    return false;
  }
}