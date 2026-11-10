/*
 * ScamSense · Welcome
 * The first-run welcome steps.
 */
"use strict";

function showOnboarding() {
  if (S.get("onboarded", false) || document.querySelector(".onb")) return;
  let step = 0;
  const m = document.createElement("div");
  m.className = "onb";
  document.body.appendChild(m);
  const draw = () => {
    const steps = [
      `<div class="onb-ic">${ic("globe")}</div><h2>Choose your language</h2><p class="muted">Elija su idioma · 选择语言 · اختر لغتك · زبان خود را انتخاب کنید</p>
       <div class="langgrid">${Object.entries(LANGS)
         .map(
           ([k, v]) =>
             `<button class="langbtn ${langCode() === k ? "on" : ""}" data-l="${k}">${v.name}</button>`
         )
         .join("")}</div>`,
      `<div class="onb-ic owl"><svg viewBox="0 0 120 130"><polygon points="22,34 28,4 48,22" fill="#0E7C7B"/><polygon points="98,34 92,4 72,22" fill="#0E7C7B"/><rect x="20" y="14" width="80" height="108" rx="40" fill="#0E7C7B"/><circle cx="45" cy="52" r="16" fill="#fff"/><circle cx="75" cy="52" r="16" fill="#fff"/><circle cx="45" cy="52" r="8.5" fill="#F2A541"/><circle cx="75" cy="52" r="8.5" fill="#F2A541"/><circle cx="45" cy="52" r="3.8" fill="#0E3B43"/><circle cx="75" cy="52" r="3.8" fill="#0E3B43"/><polygon points="54,70 66,70 60,82" fill="#F2A541"/></svg></div>
       <h2>${tr("Welcome to ScamSense", "Bienvenido a ScamSense")}</h2><p>${tr("ScamSense checks your email, texts, and calls for scams, and tells you in plain words what's safe and what to do.", "ScamSense revisa su correo, textos y llamadas, y le dice con palabras simples qué es seguro y qué hacer.")}</p>
       <ul class="ticks ok">${[tr("Daily Safety Report for your inbox", "Reporte diario de su correo"), tr("Pause before you pay", "Pause antes de pagar"), tr("Step-by-step help if you were scammed", "Ayuda paso a paso si le estafaron")].map(x => `<li>${ic("check")}<span>${x}</span></li>`).join("")}</ul>`,
      `<div class="onb-ic">${ic("lock")}</div><h2>${tr("Your privacy", "Su privacidad")}</h2><p>${tr("Your messages are checked on this device. They're never sold, and ScamSense never sends, deletes, or changes your email.", "Sus mensajes se revisan en este dispositivo. Nunca se venden, y ScamSense nunca envía, borra ni cambia su correo.")}</p>
       <label class="checkrow big"><input type="checkbox" id="age13"> ${tr("I'm 13 or older", "Tengo 13 años o más")}</label>`,
      `<div class="onb-ic">${ic("spark")}</div><h2>${tr("You're all set", "Todo listo")}</h2><p>${tr("Start with the demo to see how it works, or connect your Gmail.", "Empiece con la demostración para ver cómo funciona, o conecte su Gmail.")}</p>`
    ];
    m.innerHTML = `<div class="onb-box" role="dialog" aria-modal="true">${steps[step]}
      <div class="onb-dots">${steps.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div>
      <div class="row">${
        step === 3
          ? `<button class="btn primary" id="ob-demo">${t("try_demo")}</button><button class="btn ghost" id="ob-gmail">${tr("Connect Gmail", "Conectar Gmail")}</button>`
          : `<button class="btn primary" id="ob-next" ${step === 2 ? "disabled" : ""}>${tr("Continue", "Continuar")}</button>`
      }</div></div>`;
    m.querySelectorAll("[data-l]").forEach(
      b =>
        (b.onclick = async () => {
          saveCfg(Object.assign(cfg(), { lang: b.dataset.l }));
          await loadDict();
          applyLang();
          const h = location.hash.slice(1);
          go(TAB_OF[h] ? h : "today");
          draw();
        })
    );
    const a = m.querySelector("#age13");
    if (a)
      a.onchange = () => {
        m.querySelector("#ob-next").disabled = !a.checked;
      };
    const nx = m.querySelector("#ob-next");
    if (nx)
      nx.onclick = () => {
        step++;
        draw();
      };
    const fin = () => {
      S.set("onboarded", true);
      m.remove();
      go("today");
    };
    const d = m.querySelector("#ob-demo");
    if (d)
      d.onclick = () => {
        fin();
        loadDemo();
      };
    const g = m.querySelector("#ob-gmail");
    if (g)
      g.onclick = () => {
        fin();
        scanGmail();
      };
  };
  draw();
}
