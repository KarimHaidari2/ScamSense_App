/*
 * ScamSense · What's new
 * Every update to ScamSense, newest first, from whats-new.json (updated with each release).
 * A "New" badge shows on Home and Settings until the person opens this page.
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
/* Updates the person hasn't seen yet. New installs see the last 2 weeks. */
function unseenNews() {
  const seen = S.get("wn_seen", "");
  const cutoff = seen || new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  return WHATS_NEW.filter(x => (seen ? x.date > seen : x.date >= cutoff));
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
  return `<button class="grow" data-go="whatsnew"><span class="lead-ic l-amber">${ic("spark")}</span><span class="gl"><b>${tr("What's new", "Novedades")}</b><span>${tr("Every update to ScamSense, newest first", "Cada mejora de ScamSense, lo más nuevo primero")}</span></span>${n ? `<span class="nbadge">${n}</span>` : ""}${ic("chev", "chev")}</button>`;
}

const KIND_WORD = {
  new: () => tr("New", "Nuevo"),
  better: () => tr("Better", "Mejor"),
  fixed: () => tr("Fixed", "Arreglado")
};
function renderWhatsNew() {
  const unseen = new Set(unseenNews().map(x => x.date + x.en.title));
  const byDate = {};
  WHATS_NEW.forEach(x => (byDate[x.date] = byDate[x.date] || []).push(x));
  const fmt = d =>
    new Date(d + "T12:00:00").toLocaleDateString(langCode(), {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  view.innerHTML = `${pageHead(
    tr("What's new", "Novedades"),
    tr("Every update to ScamSense, newest first.", "Cada mejora de ScamSense, lo más nuevo primero."),
    "settings"
  )}
  ${
    WHATS_NEW.length
      ? Object.keys(byDate)
          .sort()
          .reverse()
          .map(
            d =>
              `<section class="wn-day"><h2 class="sect-h">${esc(fmt(d))}</h2><ol class="wn-list">${byDate[d]
                .map(x => {
                  const t = newsText(x);
                  const isNew = unseen.has(x.date + x.en.title);
                  return `<li class="wn-item k-${esc(x.kind || "new")}"><span class="wn-ic" aria-hidden="true">${ic(x.icon || "spark")}</span><div><p class="wn-top"><span class="wn-kind">${(KIND_WORD[x.kind] || KIND_WORD.new)()}</span>${isNew ? `<span class="wn-new">${tr("Just added", "Recién agregado")}</span>` : ""}</p><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></div></li>`;
                })
                .join("")}</ol></section>`
          )
          .join("")
      : `<p class="muted">${tr("Loading updates…", "Cargando novedades…")}</p>`
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
