// =====================================================================
//  Spielerprofil bearbeiten (in der Spielerkarte, mit GitHub-Verbindung)
//  Speichert daten/spieler.js und das Bild in daten/bilder/.
// =====================================================================
import { PROFILE_FILE, PROFILE_IMG_DIR, PROFILE_IMG_SIZE } from "../kern/konstanten.js";
import { el, setMsg } from "../kern/dom.js";
import { b64encode } from "../kern/hilfen.js";
import { parseProfilesFile } from "../kern/daten.js";
import { state } from "../kern/zustand.js";
import { profileOf, profileAvatar, initials, safeLink } from "../anzeige/profil.js";
import { openPlayer } from "../anzeige/spielerkarte.js";
import { readFile, putContent } from "./github.js";

// "Jörg Müller" -> "joerg-mueller" (Dateiname des Bildes)
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

export function profileEditor(name) {
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
      (p.bild || state.profilePreview[name]) ? el("button", { type: "button", class: "linkbtn", text: "Bild entfernen",
        onclick: function () { newImg = null; removeImg = true; showPreview(null); } }) : null,
    ]),
    el("div", { class: "profile-actions" }, [
      save,
      el("button", { type: "button", class: "btn", text: "Abbrechen", onclick: function () { openPlayer(name); } }),
    ]),
    msg,
  ]);
}

// Neuer Inhalt für daten/spieler.js
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
      const data = newImg.split(",")[1];
      let ok = await putContent(path, data, "Profilbild: " + name);
      if (ok === null) ok = await putContent(path, data, "Profilbild: " + name);
      if (ok === null) throw new Error("Das Bild konnte nicht gespeichert werden. Bitte noch einmal versuchen.");
      entry.bild = path + "?v=" + Date.now();       // neue Nummer, damit kein altes Bild aus dem Speicher kommt
      state.profilePreview[name] = newImg;
    } else if (!removeImg && old.bild) {
      entry.bild = old.bild;
    } else {
      delete state.profilePreview[name];
    }
    // Neuesten Stand holen und nur diesen Spieler ändern (andere Profile bleiben unberührt)
    for (let attempt = 0; attempt < 3; attempt++) {
      setMsg(msg, "Speichere Profil …");
      const current = await readFile(PROFILE_FILE);
      const all = current ? parseProfilesFile(current.text) : {};
      all[name] = entry;
      const ok = await putContent(PROFILE_FILE, b64encode(serializeProfiles(all)), "Profil: " + name, current ? current.sha : null);
      if (ok !== null) { state.profiles = all; return true; }
    }
    throw new Error("Speichern ist mit einer anderen Änderung zusammengestoßen. Bitte noch einmal versuchen.");
  } catch (e) {
    setMsg(msg, (e && e.message) ? e.message : "Speichern fehlgeschlagen.", "err");
    return false;
  }
}
