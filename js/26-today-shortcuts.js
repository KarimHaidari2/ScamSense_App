/*
 * ScamSense · Home
 * Top: a navy welcome panel with the owl, "Got something strange?", and today's email status.
 * Then: the check box right on Home (paste or say it), the two "help now" tiles, and the small links.
 * Family and Settings use the same navy panel at the top (heroHead).
 */
"use strict";

/* The owl drawing, in light colors for the navy panel. */
const OWL_LIGHT = `<svg viewBox="0 0 120 130" aria-hidden="true"><polygon points="22,34 28,4 48,22" fill="#F5F5F2"/><polygon points="98,34 92,4 72,22" fill="#F5F5F2"/><rect x="20" y="14" width="80" height="108" rx="40" fill="#F5F5F2"/><path d="M30,70 C30,96 44,112 60,116 C76,112 90,96 90,70 Z" fill="#DADDE5"/><circle cx="45" cy="52" r="16" fill="#14213D"/><circle cx="75" cy="52" r="16" fill="#14213D"/><circle cx="45" cy="52" r="8.5" fill="#E0A93B"/><circle cx="75" cy="52" r="8.5" fill="#E0A93B"/><circle cx="45" cy="52" r="3.8" fill="#14213D"/><circle cx="75" cy="52" r="3.8" fill="#14213D"/><polygon points="54,70 66,70 60,82" fill="#E0A93B"/><polyline points="46,96 56,106 76,86" fill="none" stroke="#14213D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* Turns the navy top panel on for this screen (the header goes white on top of it). */
function useHero(on) {
  document.body.classList.toggle("tophero", !!on);
  const head = document.querySelector(".app > header");
  if (on && head)
    document.documentElement.style.setProperty(
      "--headh",
      Math.round(head.getBoundingClientRect().bottom - head.parentElement.getBoundingClientRect().top) + "px"
    );
}
addEventListener("resize", () => {
  if (document.body.classList.contains("tophero")) useHero(true);
});

/* The navy panel used at the top of Family and Settings. */
function heroHead(title, sub) {
  useHero(true);
  return `<section class="nw-hero"><h1>${title}</h1>${sub ? `<p class="nw-sub">${sub}</p>` : ""}</section>`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12
    ? tr("Good morning", "Buenos días")
    : h < 18
      ? tr("Good afternoon", "Buenas tardes")
      : tr("Good evening", "Buenas noches");
}

/* Which inboxes were checked, in words: "Gmail", "Gmail and Outlook", "the demo inbox". */
function inboxWords(rep) {
  return rep.source === "demo"
    ? tr("The demo inbox", "La bandeja de prueba")
    : rep.source === "outlook"
      ? "Outlook"
      : rep.source === "mixed"
        ? tr("Gmail and Outlook", "Gmail y Outlook")
        : "Gmail";
}
function isNight() {
  const h = new Date().getHours();
  return h >= 18 || h < 5;
}
/* The big line in the navy panel: how protected you are right now. */
function homeHeadline(rep) {
  if (!rep) return tr("Let's keep you safe.", "Vamos a protegerle.");
  const n = { scam: 0, warn: 0, safe: 0 };
  rep.items.forEach(i => n[i.level]++);
  if (n.scam)
    return n.scam === 1
      ? tr("1 scam caught today.", "1 estafa detectada hoy.")
      : tr(`${n.scam} scams caught today.`, `${n.scam} estafas detectadas hoy.`);
  if (n.warn) return tr("A few emails need a look.", "Algunos correos necesitan revisión.");
  return isNight()
    ? tr("You're protected tonight.", "Está protegido esta noche.")
    : tr("You're protected today.", "Está protegido hoy.");
}
/* Today's email status, shown as one tappable line in the navy panel. */
function homeStatus(rep) {
  if (!rep)
    return `<button class="nw-status off" data-home="connect"><i>${ic("mail")}</i><span><b>${tr("Let ScamSense watch your email", "Deje que ScamSense vigile su correo")}</b><small>${tr("Connect Gmail or Outlook, or try the demo", "Conecte Gmail u Outlook, o pruebe la demostración")}</small></span>${ic("chev", "chev")}</button>`;
  const n = { scam: 0, warn: 0, safe: 0 };
  rep.items.forEach(i => n[i.level]++);
  const lv = n.scam ? "scam" : n.warn ? "warn" : "safe";
  const title =
    lv === "safe"
      ? rep.source === "demo"
        ? tr("No scams in the demo inbox", "No hay estafas en la bandeja de prueba")
        : tr("No scams in your email today", "No hay estafas en su correo hoy")
      : lv === "scam"
        ? n.scam === 1
          ? tr("Don't open it. Tap to see which one.", "No lo abra. Toque para ver cuál.")
          : tr("Don't open them. Tap to see which ones.", "No los abra. Toque para ver cuáles.")
        : tr("Tap to see which ones.", "Toque para ver cuáles.");
  const sub = tr(
    `${inboxWords(rep)} checked ${fmtTime(rep.at)}`,
    `${inboxWords(rep)} revisado ${fmtTime(rep.at)}`
  );
  return `<button class="nw-status ${lv}" data-home="emails"><i>${ic(lv === "safe" ? "check" : "alert")}</i><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>${ic("chev", "chev")}</button>`;
}

function homeHTML(rep) {
  const m = monthData();
  const canListen = canListenHere();
  const row = (attr, icn, title, sub) =>
    `<button class="grow" ${attr}><span class="tile-ic sm t-dev">${ic(icn)}</span><span class="gl"><b>${title}</b><span>${sub}</span></span>${ic("chev", "chev")}</button>`;
  const email = rep
    ? row(
        'data-home="emails"',
        "mail",
        tr("Your email", "Su correo"),
        esc(
          `${tr(`${rep.items.length} emails`, `${rep.items.length} correos`)}${accountSummary(rep.items) ? " · " + accountSummary(rep.items) : ""}`
        )
      ) +
      row(
        'data-home="scan"',
        "refresh",
        rep.source === "demo" ? t("scan_my") : tr("Scan email again", "Revisar el correo otra vez"),
        tr("Checks every folder for new scams", "Revisa todas las carpetas")
      )
    : row(
        'data-home="scan"',
        "mail",
        t("scan_my"),
        tr("Checks every folder, read-only", "Revisa todas las carpetas, solo lectura")
      ) +
      row(
        'data-home="demo"',
        "spark",
        t("try_demo"),
        tr("See how it works with made-up emails", "Vea cómo funciona con correos inventados")
      );
  return `<div class="home">
  <section class="nw-hero home-hero">
    <div class="nw-owl">${OWL_LIGHT}</div>
    <p class="nw-greet">${esc(greeting() + (cfg().name ? ", " + cfg().name : ""))}</p>
    <h1>${esc(homeHeadline(rep))}</h1>
    ${homeStatus(rep)}
  </section>

  <h2 class="home-q">${tr("What's happening?", "¿Qué está pasando?")}</h2>
  <section class="askcard" aria-label="${esc(tr("Check something", "Revisar algo"))}">
    <p class="ask-h">${ic("scan")}<b>${tr("Check something", "Revisar algo")}</b></p>
    <label class="sr" for="hbox">${tr("Paste or type what you got", "Pegue o escriba lo que recibió")}</label>
    <textarea id="hbox" rows="3" placeholder="${esc(tr("Paste a text, email, link, or phone number…", "Pegue un texto, correo, enlace o número…"))}"></textarea>
    <div class="btnrow"><button class="btn primary" id="hgo">${tr("Check it", "Revisar")}</button>${canListen ? `<button class="btn ghost" id="hmic" aria-pressed="false">${ic("mic")}<span>${tr("Say it", "Dígalo")}</span></button>` : ""}</div>
    <div class="ask-ex" role="group" aria-label="${esc(t("try_example"))}">${CHECK_EXAMPLES.slice(0, 4)
      .map(([v, label]) => `<button class="chip" data-hx="${esc(v)}">${esc(label())}</button>`)
      .join("")}</div>
  </section>

  <div class="help2">
    <button class="htile h-pay" data-go="pause">${ic("hand")}<b>${tr("Someone wants my money", "Alguien quiere mi dinero")}</b><span>${tr("Check before you pay", "Revise antes de pagar")}</span></button>
    <button class="htile h-sos" data-go="scammed">${ic("sos")}<b>${t("scammed_card")}</b><span>${tr("Get help right now", "Reciba ayuda ahora")}</span></button>
  </div>

  <section class="sect"><h2 class="sect-h">${tr("Email", "Correo")}</h2><div class="group">${email}</div></section>
  <section class="sect"><h2 class="sect-h">${tr("More", "Más")}</h2><div class="group">
    ${row('data-go="learn"', "spark", tr("Learn about scams", "Aprenda sobre estafas"), tr("Short lessons, one minute each.", "Lecciones cortas, de un minuto."))}
    ${row('data-go="monthly"', "bell", tr("This month", "Este mes"), tr(`${m.caught} scams caught · ${m.checked} emails scanned`, `${m.caught} estafas detectadas · ${m.checked} correos revisados`))}
  </div></section>
  <p class="footnote">${ic("lock")}<span><b>${t("private_title")}</b> ${t("private_body")}</span></p>
</div>`;
}

function bindHome() {
  useHero(true);
  bindGo();
  const box = document.getElementById("hbox");
  const check = (text, sample) => {
    checkDraft = text;
    go("check");
    setTimeout(() => runCheck(sample || null), 30);
  };
  document.getElementById("hgo").onclick = () => {
    const v = box.value.trim();
    if (!v) {
      box.focus();
      toast(tr("Paste or type what you got first.", "Primero pegue o escriba lo que recibió."));
      return;
    }
    check(v);
  };
  const mic = document.getElementById("hmic");
  if (mic)
    mic.onclick = () =>
      toggleListening(
        "hbox",
        "hmic",
        () => {},
        v => v && v.trim() && check(v.trim())
      );
  view.querySelectorAll("[data-hx]").forEach(
    b =>
      (b.onclick = () => {
        const v = b.dataset.hx,
          sample = SAMPLES[v];
        check(sample ? (sample.num ? sample.num + "\n" : "") + sample.text : v, sample ? v : null);
      })
  );
  view.querySelectorAll("[data-home]").forEach(
    b =>
      (b.onclick = () => {
        const a = b.dataset.home;
        if (a === "emails") {
          filter = "all";
          go("emails");
        } else if (a === "scan") scanEmail();
        else if (a === "demo") loadDemo();
        else if (a === "connect") go("settings");
      })
  );
}

/* Kept for other screens that link back to the Home actions. */
function homeActionsHTML() {
  return "";
}
function bindGo(root) {
  (root || view).querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
}
