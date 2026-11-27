/*
 * ScamSense · What's new
 * Updates to ScamSense from whats-new.json (updated with each release).
 * Each update shows for one day (24 hours from when this device first sees it), then folds away
 * under "Older updates", so the page stays short. A "New" badge shows on Home and Settings until
 * the person opens this page.
 */
"use strict";

let WHATS_NEW = S.get("wn_cache", []);
async function loadWhatsNew() {
  try {
    const r = await fetch("whats-new.json", { cache: "no-cache" });
    const j = await r.json();
    WHATS_NEW = (j.items || []).filter(x => x && x.date && x.en);
    S.set("wn_cache", WHATS_NEW);
    updateNewBadges();
  } catch (e) {}
}
const NEWS_SHOW_HOURS = 24;
const newsKey = x => x.date + "|" + x.en.title;
/* When this device first saw each update. An update already 2+ days old the first time we see it
   (older releases, or a new install) is never shown as new. */
function newsFirstSeen() {
  const m = S.get("wn_first", {}) || {};
  let changed = false;
  WHATS_NEW.forEach(x => {
    const k = newsKey(x);
    if (m[k] === undefined) {
      const age = Date.now() - new Date(x.date + "T00:00:00").getTime();
      m[k] = age > 2 * 864e5 ? 0 : Date.now();
      changed = true;
    }
  });
  if (changed) S.set("wn_first", m);
  return m;
}
/* Updates still inside their one day. */
function freshNews() {
  const m = newsFirstSeen();
  return WHATS_NEW.filter(x => m[newsKey(x)] && Date.now() - m[newsKey(x)] < NEWS_SHOW_HOURS * 36e5);
}
/* Fresh updates the person hasn't opened yet (for the Home strip and the badge). */
function unseenNews() {
  const seen = S.get("wn_seen", "");
  return freshNews().filter(x => !seen || x.date > seen);
}
const newsText = x => (langCode() === "es" && x.es ? x.es : x.en);
function updateNewBadges() {
  const n = unseenNews().length;
  const tab = document.querySelector('nav.tabs [data-tab="settings"]');
  if (tab) {
    let d = tab.querySelector(".newdot");
    if (n && !d) {
      d = document.createElement("i");
      d.className = "newdot";
      d.setAttribute("aria-label", tr("New updates", "Novedades"));
      tab.appendChild(d);
    } else if (!n && d) d.remove();
  }
}

/* A small strip on Home: "New: <title>". */
function newsStripHTML() {
  const u = unseenNews();
  if (!u.length) return "";
  return `<button class="news-strip" data-go="whatsnew"><span class="ns-tag">${tr("New", "Nuevo")}</span><span class="ns-t">${esc(newsText(u[0]).title)}${u.length > 1 ? ` <small>${tr(`+${u.length - 1} more`, `+${u.length - 1} más`)}</small>` : ""}</span>${ic("chev", "chev")}</button>`;
}
/* A row in Settings. */
function newsRowHTML() {
  const n = unseenNews().length;
  return `<button class="grow" data-go="whatsnew"><span class="lead-ic l-amber">${ic("spark")}</span><span class="gl"><b>${tr("What's new", "Novedades")}</b><span>${tr("New updates show here for a day", "Las novedades se muestran aquí por un día")}</span></span>${n ? `<span class="nbadge">${n}</span>` : ""}${ic("chev", "chev")}</button>`;
}

const KIND_WORD = {
  new: () => tr("New", "Nuevo"),
  better: () => tr("Better", "Mejor"),
  fixed: () => tr("Fixed", "Arreglado")
};
function renderWhatsNew() {
  const unseen = new Set(unseenNews().map(newsKey));
  const fresh = freshNews();
  const freshKeys = new Set(fresh.map(newsKey));
  const older = WHATS_NEW.filter(x => !freshKeys.has(newsKey(x)));
  const fmt = d =>
    new Date(d + "T12:00:00").toLocaleDateString(langCode(), {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  const days = list => {
    const byDate = {};
    list.forEach(x => (byDate[x.date] = byDate[x.date] || []).push(x));
    return Object.keys(byDate)
      .sort()
      .reverse()
      .map(
        d =>
          `<section class="wn-day"><h2 class="sect-h">${esc(fmt(d))}</h2><ol class="wn-list">${byDate[d]
            .map(x => {
              const t = newsText(x);
              const isNew = unseen.has(newsKey(x));
              return `<li class="wn-item k-${esc(x.kind || "new")}"><span class="wn-ic" aria-hidden="true">${ic(x.icon || "spark")}</span><div><p class="wn-top"><span class="wn-kind">${(KIND_WORD[x.kind] || KIND_WORD.new)()}</span>${isNew ? `<span class="wn-new">${tr("Just added", "Recién agregado")}</span>` : ""}</p><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></div></li>`;
            })
            .join("")}</ol></section>`
      )
      .join("");
  };
  view.innerHTML = `${pageHead(
    tr("What's new", "Novedades"),
    tr("New updates show here for a day.", "Las novedades se muestran aquí por un día."),
    "settings"
  )}
  ${
    !WHATS_NEW.length
      ? `<p class="muted">${tr("Loading updates…", "Cargando novedades…")}</p>`
      : fresh.length
        ? days(fresh)
        : `<div class="empty card">${tr("You're up to date. Nothing new today.", "Está al día. Nada nuevo hoy.")}</div>`
  }
  ${
    older.length
      ? `<details class="adgroup wn-older"><summary><span class="adg-ic">${ic("spark")}</span><span class="gl"><b>${tr(`Older updates (${older.length})`, `Novedades anteriores (${older.length})`)}</b></span>${ic("chev", "chev")}</summary>${days(older)}</details>`
      : ""
  }`;
  bindBack();
  if (WHATS_NEW.length)
    S.set(
      "wn_seen",
      WHATS_NEW.map(x => x.date)
        .sort()
        .pop()
    );
  updateNewBadges();
}

document.addEventListener("DOMContentLoaded", () => {
  updateNewBadges();
  setTimeout(loadWhatsNew, 1500);
});
