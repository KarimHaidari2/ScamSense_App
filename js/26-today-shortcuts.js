/*
 * ScamSense · Home actions
 * The three big buttons on Home ("What's happening?") and the small links under them.
 */
"use strict";

function homeActionsHTML() {
  const m = monthData();
  const big = (go, cls, icn, title, sub) =>
    `<button class="act ${cls}" data-go="${go}"><span class="act-ic">${ic(icn)}</span><span class="act-tx"><b>${title}</b><span>${sub}</span></span>${ic("chev", "chev")}</button>`;
  const row = (go, icn, title, sub) =>
    `<button class="grow" data-go="${go}"><span class="tile-ic sm t-dev">${ic(icn)}</span><span class="gl"><b>${title}</b><span>${sub}</span></span>${ic("chev", "chev")}</button>`;
  return `<section class="sect"><h2 class="home-q">${tr("What's happening?", "¿Qué está pasando?")}</h2><div class="acts">
    ${big("check", "a-check", "scan", tr("Check something", "Revisar algo"), tr("A message, call, link, or number", "Un mensaje, llamada, enlace o número"))}
    ${big("pause", "a-pause", "hand", tr("Someone wants my money", "Alguien quiere mi dinero"), tr("Check before you pay anyone", "Revise antes de pagarle a alguien"))}
    ${big("scammed", "a-sos", "sos", t("scammed_card"), tr("Get help right now, step by step", "Reciba ayuda ahora, paso a paso"))}
  </div></section>
  <section class="sect"><div class="group">
    ${row("learn", "spark", tr("Learn about scams", "Aprenda sobre estafas"), tr("Short lessons, one minute each.", "Lecciones cortas, de un minuto."))}
    ${row("monthly", "bell", tr("This month", "Este mes"), tr(`${m.caught} scams caught · ${m.checked} emails scanned`, `${m.caught} estafas detectadas · ${m.checked} correos revisados`))}
  </div></section>`;
}
function bindGo(root) {
  (root || view).querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
}
