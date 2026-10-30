// =====================================================================
//  Spielerprofile in der Spielerkarte: Bild, Spitzname, Walk-on-Song
//  Gespeichert in daten/spieler.js, Bilder in daten/bilder/.
//  Bearbeiten: bearbeiten/profil-editor.js
// =====================================================================
import { PROFILE_IMG_DIR } from "../kern/konstanten.js";
import { el, getDialog } from "../kern/dom.js";
import { state, gh } from "../kern/zustand.js";
import { profileEditor } from "../bearbeiten/profil-editor.js";

export function profileOf(name) { return state.profiles[name] || {}; }

// Nur http(s)-Links zulassen
export function safeLink(url) {
  return /^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : "";
}

// Nur Bilder aus daten/bilder/ oder per https
function safeImg(path) {
  const p = String(path || "").trim();
  return (p.indexOf(PROFILE_IMG_DIR) === 0 || /^https:\/\//i.test(p)) ? p : "";
}

export function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
}

// Rundes Bild (oder Initialen)
export function profileAvatar(name) {
  const src = state.profilePreview[name] || safeImg(profileOf(name).bild);
  if (src) return el("img", { class: "avatar", src: src, alt: "Bild von " + name });
  return el("span", { class: "avatar initials", text: initials(name), "aria-hidden": "true" });
}

// ---------------------------------------------------------------------
//  Walk-on-Song
// ---------------------------------------------------------------------

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
export function initSongStop() {
  const dlg = getDialog("player-dialog");
  dlg.addEventListener("close", function () {
    dlg.querySelectorAll(".song-player").forEach(function (x) { x.remove(); });
    dlg.querySelectorAll(".song-btn").forEach(function (b) { b.textContent = "▶ anhören"; });
  });
}

// Spitzname und Song unter dem Namen (+ „Profil bearbeiten“ im Bearbeiten-Modus)
export function profileInfo(name) {
  const p = profileOf(name);
  const box = el("div", { class: "profile-info" });
  // Etwas in voller Breite direkt unter den Kopf der Spielerkarte setzen
  const putBelowHead = function (node) {
    const head = box.closest(".pc-head");
    if (head) head.after(node); else box.appendChild(node);
  };
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
      putBelowHead(player);
      play.textContent = "■ Player schließen";
    });
    box.appendChild(el("p", { class: "walkon" }, [el("span", { text: "🎵 " + p.song }), play]));
  }
  if (state.editing && gh.connected) {
    const editBtn = el("button", { type: "button", class: "linkbtn", text: "✏️ Profil bearbeiten",
      onclick: function () {
        putBelowHead(profileEditor(name));
        editBtn.hidden = true;
      } });
    box.appendChild(editBtn);
  }
  return box;
}
