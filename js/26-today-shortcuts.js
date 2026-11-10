/*
 * ScamSense · Today shortcuts
 * The Quick help list on the Today screen.
 */
"use strict";

function todayExtrasHTML() {
  const m = monthData();
  const row = (go, cls, icn, title, sub) =>
    `<button class="grow" data-go="${go}"><span class="tile-ic sm ${cls}">${ic(icn)}</span><span class="gl"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</span>${ic("chev", "chev")}</button>`;
  return `<section class="sect"><h2 class="sect-h">${tr("Quick help", "Ayuda rápida")}</h2><div class="group">
    ${row("check", "t-mail", "scan", tr("Check something", "Revisar algo"), tr("An email, text, call, or crypto site", "Un correo, texto, llamada o sitio cripto"))}
    ${row("pause", "t-call", "hand", t("pause_card"), tr("Someone is asking you for money", "Alguien le pide dinero"))}
    ${row("scammed", "t-sos", "sos", t("scammed_card"), tr("Get a step-by-step recovery plan", "Obtenga un plan de recuperación paso a paso"))}
    ${row("monthly", "t-dev", "bell", tr("This month", "Este mes"), tr(`${m.caught} scams caught · ${m.checked} emails scanned`, `${m.caught} estafas detectadas · ${m.checked} correos revisados`))}
  </div></section>`;
}
function bindGo(root) {
  (root || view).querySelectorAll("[data-go]").forEach(b => (b.onclick = () => go(b.dataset.go)));
}
