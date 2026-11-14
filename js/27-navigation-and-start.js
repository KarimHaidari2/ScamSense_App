/*
 * ScamSense · Navigation and start
 * Moves between screens, the floating Ask Mahi button, and starts the app.
 */
"use strict";

/* ----- navigation ----- */
const TAB_OF = {
  today: "today",
  emails: "today",
  check: "today",
  preview: "today",
  pause: "today",
  scammed: "today",
  learn: "today",
  lesson: "today",
  monthly: "today",
  helper: "today",
  family: "family",
  settings: "settings",
  plans: "settings",
  share: "settings"
};
/* Old screen names (from saved links or Mahi) open the screen that replaced them. */
const OLD_SCREENS = {
  checkEmail: "check",
  checkText: "check",
  checkCall: "check",
  checkCrypto: "check",
  help: "today"
};
function fillLangTop() {
  const el = document.getElementById("langtop");
  if (!el) return;
  el.innerHTML = Object.keys(LANGS)
    .map(k => `<option value="${k}" ${langCode() === k ? "selected" : ""}>${LANGS[k].name}</option>`)
    .join("");
  el.onchange = async () => {
    saveCfg(Object.assign(cfg(), { lang: el.value }));
    await loadDict();
    applyLang();
    const h = location.hash.slice(1);
    go(TAB_OF[h] ? h : "today");
  };
}
function applyLang() {
  fillLangTop();
  document.documentElement.lang = langCode();
  document.documentElement.dir = LANGS[langCode()].rtl ? "rtl" : "ltr";
  document
    .querySelectorAll("nav.tabs [data-tab]")
    .forEach(b => (b.querySelector("span").textContent = t("tab_" + b.dataset.tab)));
  setStatus();
  if (Reader.active) updatePlayer();
}

/* ----- floating "Ask Mahi" button: tap to open, drag to move ----- */
const Fab = (() => {
  const el = () => document.getElementById("agentfab");
  const M = 12;
  function bounds() {
    const b = el();
    const nav = document.querySelector("nav.tabs");
    const navH = nav ? innerHeight - nav.getBoundingClientRect().top : 70; // the bar floats above the bottom edge
    return {
      minX: M,
      maxX: innerWidth - b.offsetWidth - M,
      minY: 70,
      maxY: innerHeight - navH - b.offsetHeight - M
    };
  }
  function place(x, y) {
    const b = el(),
      B = bounds();
    x = Math.min(Math.max(x, B.minX), B.maxX);
    y = Math.min(Math.max(y, B.minY), B.maxY);
    b.style.left = x + "px";
    b.style.top = y + "px";
    return { x, y };
  }
  function snap(save) {
    const b = el();
    const r = b.getBoundingClientRect();
    const B = bounds();
    const toLeft = r.left + r.width / 2 < innerWidth / 2;
    const p = place(toLeft ? B.minX : B.maxX, r.top);
    if (save) S.set("fab", { side: toLeft ? "left" : "right", y: p.y / innerHeight });
  }
  function restore() {
    const b = el();
    const st = S.get("fab", null);
    const B = bounds();
    const y = st && typeof st.y === "number" ? st.y * innerHeight : B.maxY;
    const right =
      !st || st.side !== "left" ? (document.documentElement.dir === "rtl" && !st ? false : true) : false;
    place(right ? B.maxX : B.minX, y);
  }
  function init() {
    const b = el();
    if (!b || b.dataset.ready) return;
    b.dataset.ready = "1";
    let start = null,
      moved = false,
      off = null;
    b.addEventListener("pointerdown", e => {
      start = { x: e.clientX, y: e.clientY };
      moved = false;
      const r = b.getBoundingClientRect();
      off = { x: e.clientX - r.left, y: e.clientY - r.top };
      try {
        b.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    b.addEventListener("pointermove", e => {
      if (!start) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
      moved = true;
      b.classList.add("dragging");
      place(e.clientX - off.x, e.clientY - off.y);
    });
    const end = e => {
      if (!start) return;
      start = null;
      b.classList.remove("dragging");
      if (moved) snap(true);
    };
    b.addEventListener("pointerup", end);
    b.addEventListener("pointercancel", end);
    b.addEventListener("click", e => {
      if (moved) {
        e.preventDefault();
        moved = false;
        return;
      }
      go("helper");
    });
    b.addEventListener("keydown", e => {
      const B = bounds();
      const r = b.getBoundingClientRect();
      if (e.key === "ArrowLeft") {
        place(B.minX, r.top);
        S.set("fab", { side: "left", y: r.top / innerHeight });
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        place(B.maxX, r.top);
        S.set("fab", { side: "right", y: r.top / innerHeight });
        e.preventDefault();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const p = place(r.left, r.top + (e.key === "ArrowUp" ? -40 : 40));
        snap(true);
        e.preventDefault();
      }
    });
    addEventListener("resize", () => {
      if (!b.hidden) restore();
    });
  }
  function update(tab) {
    const b = el();
    if (!b) return;
    init();
    const label = tr("Ask Mahi", "Pregúntele a Mahi");
    document.getElementById("agentfab-l").textContent = label;
    b.setAttribute("aria-label", label + " — " + tr("drag to move", "arrastre para mover"));
    b.hidden = tab === "helper";
    if (!b.hidden) requestAnimationFrame(restore);
  }
  return { update };
})();
function go(tab) {
  if (Reader.active) stopSpeaking();
  clearInterval(stillTimer);
  if (typeof simClear === "function") simClear();
  tab = OLD_SCREENS[tab] || tab;
  useHero(false); // Home, Family and Settings turn the navy top panel back on
  const top = TAB_OF[tab] || "today";
  document.querySelectorAll("nav.tabs button").forEach(b => {
    if (b.dataset.tab === top) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  (
    ({
      today: renderToday,
      emails: renderEmails,
      check: renderCheck,
      learn: renderLearn,
      lesson: renderLesson,
      monthly: renderMonthly,
      helper: renderHelper,
      plans: renderPlans,
      preview: renderPreview,
      pause: renderPause,
      scammed: renderScammed,
      family: renderFamily,
      settings: renderSettings,
      share: renderShare
    })[tab] || renderToday
  )();
  window.scrollTo(0, 0);
  try {
    history.replaceState(null, "", "#" + tab);
  } catch (e) {}
  Fab.update(tab);
}
document.querySelectorAll("nav.tabs button").forEach(b => (b.onclick = () => go(b.dataset.tab)));
/* Start the app once every script file has loaded. */
function startApp() {
  loadDict().then(() => {
    applyLang();
    const start = OLD_SCREENS[location.hash.slice(1)] || location.hash.slice(1);
    // A text shared from another app (or a ?check= link) opens straight into Check something.
    if (!openSharedText()) go(TAB_OF[start] ? start : "today");
    showOnboarding();
    showLock();
    finishOutlookSignIn(); // back from Microsoft sign-in?
  });
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", startApp);
else startApp();
